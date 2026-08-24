import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { ImportType, PlannedSituation } from '../../common/enums';
import { parseExcelBuffer, toDate, toNumber } from '../../common/utils/excel.util';
import { OrgService } from '../org/org.service';
import { ImportBatchService } from '../imports/import-batch.service';
import { Employee } from '../employees/entities/employee.entity';
import { BudgetEntry } from './entities/budget-entry.entity';
import { BudgetEntryQueryDto } from './dto/budget.dto';

const SITUATION_ALIASES: Record<string, PlannedSituation> = {
  SEM_MOVIMENTACAO: PlannedSituation.SEM_MOVIMENTACAO,
  'SEM MOVIMENTACAO': PlannedSituation.SEM_MOVIMENTACAO,
  PROMOCAO: PlannedSituation.PROMOCAO,
  MERITO: PlannedSituation.MERITO,
  TRANSFERENCIA: PlannedSituation.TRANSFERENCIA,
  NOVA_VAGA: PlannedSituation.NOVA_VAGA,
  'NOVA VAGA': PlannedSituation.NOVA_VAGA,
};

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly orgService: OrgService,
    private readonly importBatchService: ImportBatchService,
  ) {}

  async findEntries(query: BudgetEntryQueryDto, scopedDirectorateId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.budgetRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.position', 'position')
      .leftJoinAndSelect('b.directorate', 'directorate')
      .where('b.year = :year', { year: query.year });

    const directorateId = scopedDirectorateId ?? query.directorateId;
    if (directorateId) qb.andWhere('b.directorateId = :directorateId', { directorateId });

    qb.orderBy('b.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async getDashboard(year: number, scopedDirectorateId?: string) {
    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    if (scopedDirectorateId) budgetQb.andWhere('b.directorateId = :d', { d: scopedDirectorateId });
    const budgetEntries = await budgetQb.getMany();

    const employeeQb = this.employeeRepo.createQueryBuilder('e');
    if (scopedDirectorateId) employeeQb.andWhere('e.directorateId = :d', { d: scopedDirectorateId });
    const employees = await employeeQb.getMany();

    const hcBudgeted = budgetEntries.length;
    const hcCurrent = employees.length;
    const payrollBudgeted = budgetEntries.reduce((sum, b) => sum + Number(b.currentSalary || 0), 0);
    const payrollCurrent = employees.reduce((sum, e) => sum + Number(e.currentSalary || 0), 0);
    const financialDeviation = payrollCurrent - payrollBudgeted;
    const budgetConsumedPercent = payrollBudgeted > 0 ? (payrollCurrent / payrollBudgeted) * 100 : 0;

    return {
      hcBudgeted,
      hcCurrent,
      hcDifference: hcCurrent - hcBudgeted,
      payrollBudgeted,
      payrollCurrent,
      financialDeviation,
      budgetConsumedPercent: Number(budgetConsumedPercent.toFixed(2)),
    };
  }

  /**
   * Importa o orçamento anual a partir de uma planilha Excel.
   * Colunas esperadas (normalizadas): matricula, nome, cargo, diretoria,
   * gerencia, coordenacao, centro_de_custo, cidade, estado, tipo_contrato,
   * data_admissao, salario_atual, situacao_planejada, salario_orcado,
   * mes_previsto, custo_mensal_orcado, custo_anual_orcado.
   */
  async importFromExcel(buffer: Buffer, filename: string, year: number, importedById: string) {
    const batch = await this.importBatchService.create(
      ImportType.ORCAMENTO,
      filename,
      importedById,
      year,
    );

    const rows = await parseExcelBuffer(buffer);
    const errors: { rowNumber: number; field?: string; message: string }[] = [];
    let successRows = 0;
    const seenRegistrations = new Set<string>();

    for (const row of rows) {
      const data = row.data;
      const registration = data['matricula'] ? String(data['matricula']).trim() : undefined;
      const name = String(data['nome'] ?? '').trim();
      const positionName = String(data['cargo'] ?? '').trim();
      const directorateName = String(data['diretoria'] ?? '').trim();
      const currentSalary = toNumber(data['salario_atual']) ?? 0;
      const plannedSalary = toNumber(data['salario_orcado']) ?? 0;
      const situationRaw = String(data['situacao_planejada'] ?? 'SEM_MOVIMENTACAO')
        .trim()
        .toUpperCase();
      const plannedMonth = toNumber(data['mes_previsto']);
      const monthlyBudgetedCost = toNumber(data['custo_mensal_orcado']) ?? 0;
      const annualBudgetedCost = toNumber(data['custo_anual_orcado']) ?? 0;

      const plannedSituation = SITUATION_ALIASES[situationRaw];

      if (!positionName) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: 'Cargo é obrigatório' });
        continue;
      }
      if (!directorateName) {
        errors.push({ rowNumber: row.rowNumber, field: 'diretoria', message: 'Diretoria é obrigatória' });
        continue;
      }
      if (!plannedSituation) {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'situacao_planejada',
          message: `Situação planejada inválida: ${situationRaw}`,
        });
        continue;
      }
      if (plannedSituation !== PlannedSituation.NOVA_VAGA && !registration) {
        errors.push({ rowNumber: row.rowNumber, field: 'matricula', message: 'Matrícula é obrigatória' });
        continue;
      }
      if (registration) {
        if (seenRegistrations.has(registration)) {
          errors.push({ rowNumber: row.rowNumber, field: 'matricula', message: `Matrícula duplicada na planilha: ${registration}` });
          continue;
        }
        seenRegistrations.add(registration);
      }
      if (currentSalary < 0 || plannedSalary < 0) {
        errors.push({ rowNumber: row.rowNumber, field: 'salario', message: 'Salário inválido' });
        continue;
      }

      const position = await this.orgService.findPositionByName(positionName);
      if (!position) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: `Cargo inexistente: ${positionName}` });
        continue;
      }
      const directorate = await this.orgService.findDirectorateByName(directorateName);
      if (!directorate) {
        errors.push({ rowNumber: row.rowNumber, field: 'diretoria', message: `Diretoria inexistente: ${directorateName}` });
        continue;
      }

      const employee = registration
        ? await this.employeeRepo.findOne({ where: { registration } })
        : null;

      const admissionDate = toDate(data['data_admissao']);

      const existing = registration
        ? await this.budgetRepo.findOne({ where: { year, registration } })
        : null;

      const payload = {
        year,
        registration,
        employeeId: employee?.id,
        name: name || employee?.name,
        positionId: position.id,
        directorateId: directorate.id,
        city: data['cidade'] ? String(data['cidade']) : undefined,
        state: data['estado'] ? String(data['estado']).toUpperCase().slice(0, 2) : undefined,
        admissionDate: admissionDate ? admissionDate.toISOString().slice(0, 10) : undefined,
        currentSalary,
        plannedSituation,
        plannedSalary,
        plannedMonth: plannedMonth ?? undefined,
        monthlyBudgetedCost,
        annualBudgetedCost,
        importBatchId: batch.id,
      };

      if (existing) {
        await this.budgetRepo.update(existing.id, payload);
      } else {
        await this.budgetRepo.save(this.budgetRepo.create(payload));
      }
      successRows += 1;
    }

    return this.importBatchService.finish(batch.id, rows.length, successRows, errors);
  }
}
