import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { ImportType, MONTH_KEYS, MonthKey, PlannedSituation } from '../../common/enums';
import { parseExcelSheetRaw, toNumber } from '../../common/utils/excel.util';
import { monthKeyFromNumber, monthValue, sumAllMonths } from '../../common/utils/months.util';
import { OrgService } from '../org/org.service';
import { ImportBatchService } from '../imports/import-batch.service';
import { BudgetEntry } from './entities/budget-entry.entity';
import { BudgetDashboardQueryDto, BudgetEntryQueryDto } from './dto/budget.dto';

/** Rótulos aceitos na coluna "TIPO DE MOVIMENTAÇÃO" da planilha de orçamento. */
const SITUATION_LABELS: Record<string, PlannedSituation> = {
  SEM_MOVIMENTACAO: PlannedSituation.SEM_MOVIMENTACAO,
  'SEM MOVIMENTACAO': PlannedSituation.SEM_MOVIMENTACAO,
  'SEM MOVIMENTAÇÃO': PlannedSituation.SEM_MOVIMENTACAO,
  PROMOCAO: PlannedSituation.PROMOCAO,
  PROMOÇÃO: PlannedSituation.PROMOCAO,
  MERITO: PlannedSituation.MERITO,
  MÉRITO: PlannedSituation.MERITO,
  SUBSTITUICAO: PlannedSituation.SUBSTITUICAO,
  SUBSTITUIÇÃO: PlannedSituation.SUBSTITUICAO,
  AUMENTO_DE_QUADRO: PlannedSituation.AUMENTO_DE_QUADRO,
  'AUMENTO DE QUADRO': PlannedSituation.AUMENTO_DE_QUADRO,
  DESLIGAMENTO: PlannedSituation.DESLIGAMENTO,
};

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Cabeçalhos aceitos (normalizados) para cada coluna fixa da planilha. */
const HEADER_ALIASES = {
  directorate: ['DIRETORIA'],
  costCenter: ['CENTRO DE CUSTO', 'CENTRO_DE_CUSTO'],
  position: ['CARGO'],
  situation: ['TIPO DE MOVIMENTACAO', 'TIPO_DE_MOVIMENTACAO', 'SITUACAO PLANEJADA', 'SITUACAO_PLANEJADA'],
};

function matchesAlias(header: unknown, aliases: string[]): boolean {
  const normalized = normalizeLabel(header);
  return aliases.includes(normalized);
}

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    private readonly orgService: OrgService,
    private readonly importBatchService: ImportBatchService,
  ) {}

  async findEntries(query: BudgetEntryQueryDto, scopedDirectorateId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.budgetRepo
      .createQueryBuilder('b')
      .where('b.year = :year', { year: query.year });

    const directorateId = scopedDirectorateId ?? query.directorateId;
    if (directorateId) qb.andWhere('b.directorateId = :directorateId', { directorateId });
    if (query.costCenterId) qb.andWhere('b.costCenterId = :costCenterId', { costCenterId: query.costCenterId });
    if (query.positionId) qb.andWhere('b.positionId = :positionId', { positionId: query.positionId });

    qb.orderBy('b.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  private async loadFiltered(year: number, scopedDirectorateId?: string, costCenterId?: string) {
    const qb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    if (scopedDirectorateId) qb.andWhere('b.directorateId = :d', { d: scopedDirectorateId });
    if (costCenterId) qb.andWhere('b.costCenterId = :cc', { cc: costCenterId });
    return qb.getMany();
  }

  /**
   * HC/folha orçados no mês de referência (padrão: mês corrente) — conta uma
   * linha como "HC orçado" naquele mês quando ela tem custo orçado (não nulo)
   * no mês, e soma esse custo para a folha orçada.
   */
  async getDashboard(
    year: number,
    month: number | undefined,
    scopedDirectorateId?: string,
    costCenterId?: string,
  ) {
    const referenceMonth = month ?? new Date().getMonth() + 1;
    const entries = await this.loadFiltered(year, scopedDirectorateId, costCenterId);

    const activeEntries = entries.filter((entry) => monthValue(entry as any, referenceMonth) !== null);
    const hcBudgeted = activeEntries.length;
    const payrollBudgeted = activeEntries.reduce(
      (sum, entry) => sum + Number(monthValue(entry as any, referenceMonth) ?? 0),
      0,
    );
    const annualBudgeted = entries.reduce((sum, entry) => sum + sumAllMonths(entry as any), 0);

    return {
      year,
      month: referenceMonth,
      hcBudgeted,
      payrollBudgeted,
      annualBudgeted,
    };
  }

  /**
   * Importa o orçamento anual a partir da planilha "diretoria + centro de
   * custo + cargo + tipo de movimentação + jan..dez". As 4 primeiras colunas
   * são identificadas pelo nome do cabeçalho (aceita variações com/sem
   * acento); as 12 colunas seguintes são lidas por posição, na ordem em que
   * aparecem, e mapeadas para jan..dez — a data do primeiro cabeçalho de mês
   * (quando é uma data de verdade) define o ano, sobrepondo o parâmetro
   * `year` se ele não bater.
   */
  async importFromExcel(buffer: Buffer, filename: string, yearParam: number, importedById: string) {
    const sheet = await parseExcelSheetRaw(buffer);
    const { headers, rows } = sheet;

    const colIndex = {
      directorate: headers.findIndex((h) => matchesAlias(h, HEADER_ALIASES.directorate)),
      costCenter: headers.findIndex((h) => matchesAlias(h, HEADER_ALIASES.costCenter)),
      position: headers.findIndex((h) => matchesAlias(h, HEADER_ALIASES.position)),
      situation: headers.findIndex((h) => matchesAlias(h, HEADER_ALIASES.situation)),
    };

    const missing = Object.entries(colIndex)
      .filter(([, idx]) => idx === -1)
      .map(([key]) => key);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Planilha inválida: coluna(s) não encontrada(s): ${missing.join(', ')}. ` +
          'Esperado: DIRETORIA, CENTRO DE CUSTO, CARGO, TIPO DE MOVIMENTAÇÃO, seguidas de 12 colunas de meses (jan a dez).',
      );
    }

    const fixedCols = new Set(Object.values(colIndex));
    const monthColumns: number[] = [];
    for (let i = 1; i < headers.length; i++) {
      if (headers[i] === undefined || headers[i] === null || headers[i] === '') continue;
      if (fixedCols.has(i)) continue;
      monthColumns.push(i);
    }

    if (monthColumns.length !== 12) {
      throw new BadRequestException(
        `Planilha inválida: esperadas 12 colunas de meses (jan a dez) após as colunas fixas, ` +
          `encontradas ${monthColumns.length}.`,
      );
    }

    let year = yearParam;
    const firstHeader = headers[monthColumns[0]];
    if (firstHeader instanceof Date) {
      year = firstHeader.getFullYear();
    }

    const batch = await this.importBatchService.create(ImportType.ORCAMENTO, filename, importedById, year);

    const errors: { rowNumber: number; field?: string; message: string }[] = [];
    let successRows = 0;
    const toInsert: Partial<BudgetEntry>[] = [];

    for (const row of rows) {
      const directorateName = String(row.values[colIndex.directorate] ?? '').trim();
      const costCenterName = String(row.values[colIndex.costCenter] ?? '').trim();
      const positionName = String(row.values[colIndex.position] ?? '').trim();
      const situationRaw = String(row.values[colIndex.situation] ?? '').trim();

      const fail = (field: string, message: string) =>
        errors.push({ rowNumber: row.rowNumber, field, message });

      if (!directorateName) {
        fail('diretoria', 'Diretoria é obrigatória');
        continue;
      }
      if (!costCenterName) {
        fail('centro_de_custo', 'Centro de custo é obrigatório');
        continue;
      }
      if (!positionName) {
        fail('cargo', 'Cargo é obrigatório');
        continue;
      }
      const movementType = SITUATION_LABELS[normalizeLabel(situationRaw)];
      if (!movementType) {
        fail('tipo_de_movimentacao', `Tipo de movimentação inválido: ${situationRaw}`);
        continue;
      }

      const directorate = await this.orgService.findDirectorateByName(directorateName);
      if (!directorate) {
        fail('diretoria', `Diretoria inexistente: ${directorateName}`);
        continue;
      }
      const costCenter = await this.orgService.findCostCenterByName(costCenterName);
      if (!costCenter) {
        fail('centro_de_custo', `Centro de custo inexistente: ${costCenterName}`);
        continue;
      }
      const position = await this.orgService.findPositionByName(positionName);
      if (!position) {
        fail('cargo', `Cargo inexistente: ${positionName}`);
        continue;
      }

      const monthValues: Partial<Record<MonthKey, number | null>> = {};
      let invalidMonth: string | null = null;
      monthColumns.forEach((colNumber, i) => {
        const raw = row.values[colNumber];
        const key = MONTH_KEYS[i];
        if (raw === undefined || raw === null || raw === '' || String(raw).trim() === '-') {
          monthValues[key] = null;
          return;
        }
        const parsed = toNumber(raw);
        if (parsed === null) {
          invalidMonth = `${key}: "${raw}"`;
          return;
        }
        monthValues[key] = parsed;
      });
      if (invalidMonth) {
        fail('meses', `Valor mensal inválido em ${invalidMonth}`);
        continue;
      }

      toInsert.push({
        year,
        directorateId: directorate.id,
        costCenterId: costCenter.id,
        positionId: position.id,
        movementType,
        ...monthValues,
        importBatchId: batch.id,
      });
      successRows += 1;
    }

    if (toInsert.length > 0) {
      // Substitui integralmente o orçado do ano por diretoria/centro de custo/cargo/tipo:
      // uma reimportação corrige a planilha inteira em vez de acumular linhas antigas.
      const directorateIds = [...new Set(toInsert.map((e) => e.directorateId!))];
      await this.budgetRepo
        .createQueryBuilder()
        .delete()
        .where('year = :year AND directorate_id IN (:...directorateIds)', { year, directorateIds })
        .execute();
      await this.budgetRepo.save(toInsert as BudgetEntry[]);
    }

    return this.importBatchService.finish(batch.id, rows.length, successRows, errors);
  }
}
