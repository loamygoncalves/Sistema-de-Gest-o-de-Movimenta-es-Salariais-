import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ImportType } from '../../common/enums';
import { parseExcelSheetRaw } from '../../common/utils/excel.util';
import { ImportBatchService, RowError } from '../imports/import-batch.service';
import { Directorate } from './entities/directorate.entity';
import { Management } from './entities/management.entity';
import { Coordination } from './entities/coordination.entity';
import { Position } from './entities/position.entity';
import { CostCenter } from './entities/cost-center.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AccessScope } from '../../common/decorators/current-user.decorator';
import {
  CreateCoordinationDto,
  CreateCostCenterDto,
  CreateDirectorateDto,
  CreateManagementDto,
  CreatePositionDto,
  UpdateDirectorateDto,
  UpdatePositionDto,
} from './dto/org.dto';

/** Cabeçalhos aceitos (normalizados) para cada coluna fixa da planilha de import. */
const COST_CENTER_HEADER_ALIASES = {
  code: ['CODIGO', 'CÓDIGO'],
  name: ['CENTRO DE RESULTADO', 'CENTRO_DE_RESULTADO', 'CENTRO DE CUSTO', 'CENTRO_DE_CUSTO', 'NOME'],
  directorate: ['DIRETORIA'],
};

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matchesAlias(header: unknown, aliases: string[]): boolean {
  return aliases.includes(normalizeLabel(header));
}

function findHeaderIndex(headers: unknown[], aliases: string[]): number {
  return headers.findIndex((h) => matchesAlias(h, aliases));
}

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Directorate)
    private readonly directorateRepo: Repository<Directorate>,
    @InjectRepository(Management)
    private readonly managementRepo: Repository<Management>,
    @InjectRepository(Coordination)
    private readonly coordinationRepo: Repository<Coordination>,
    @InjectRepository(Position)
    private readonly positionRepo: Repository<Position>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly importBatchService: ImportBatchService,
  ) {}

  // Diretorias
  findAllDirectorates() {
    return this.directorateRepo.find({ order: { name: 'ASC' } });
  }

  findDirectorate(id: string) {
    return this.directorateRepo.findOneOrFail({ where: { id } });
  }

  createDirectorate(dto: CreateDirectorateDto) {
    return this.directorateRepo.save(this.directorateRepo.create(dto));
  }

  async updateDirectorate(id: string, dto: UpdateDirectorateDto) {
    await this.directorateRepo.update(id, dto);
    return this.findDirectorate(id);
  }

  async removeDirectorate(id: string) {
    await this.directorateRepo.update(id, { active: false });
  }

  // Gerências
  findManagements(directorateId?: string) {
    return this.managementRepo.find({
      where: directorateId ? { directorateId } : {},
      order: { name: 'ASC' },
    });
  }

  createManagement(dto: CreateManagementDto) {
    return this.managementRepo.save(this.managementRepo.create(dto));
  }

  // Coordenações
  findCoordinations(managementId?: string) {
    return this.coordinationRepo.find({
      where: managementId ? { managementId } : {},
      order: { name: 'ASC' },
    });
  }

  createCoordination(dto: CreateCoordinationDto) {
    return this.coordinationRepo.save(this.coordinationRepo.create(dto));
  }

  /**
   * Cargos. Para GESTOR (scope.costCenterIds definido — ver resolveAccessScope),
   * mostra só os cargos que têm (ou já tiveram) pelo menos um colaborador —
   * ativo ou inativo, por isso não filtra por status — em algum dos centros
   * de resultado dele; os demais perfis (sem escopo restrito, ou DIRETOR)
   * continuam vendo todos os cargos da empresa.
   */
  findAllPositions(scope?: AccessScope) {
    if (!scope?.costCenterIds) {
      return this.positionRepo.find({ order: { name: 'ASC' } });
    }
    if (scope.costCenterIds.length === 0) return [];
    return this.positionRepo
      .createQueryBuilder('position')
      .innerJoin(
        Employee,
        'employee',
        'employee.positionId = position.id AND employee.costCenterId IN (:...costCenterIds)',
        { costCenterIds: scope.costCenterIds },
      )
      .distinct(true)
      .orderBy('position.name', 'ASC')
      .getMany();
  }

  findPosition(id: string) {
    return this.positionRepo.findOneOrFail({ where: { id } });
  }

  findPositionByName(name: string) {
    return this.positionRepo.findOne({ where: { name } });
  }

  createPosition(dto: CreatePositionDto) {
    return this.positionRepo.save(this.positionRepo.create(dto));
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    await this.positionRepo.update(id, dto);
    return this.findPosition(id);
  }

  async removePosition(id: string) {
    await this.positionRepo.update(id, { active: false });
  }

  // Centros de custo
  findAllCostCenters() {
    return this.costCenterRepo.find({ order: { name: 'ASC' } });
  }

  createCostCenter(dto: CreateCostCenterDto) {
    return this.costCenterRepo.save(this.costCenterRepo.create(dto));
  }

  /**
   * Exclusão definitiva (não há tela de reativação para centro de custo,
   * e `code` é único — soft delete deixaria o código "preso" para sempre).
   * Colaboradores vinculados ficam com `costCenterId` nulo (SET NULL);
   * centros de custo referenciados no orçamento (FK RESTRICT) não podem
   * ser excluídos — o erro do banco é convertido em mensagem amigável.
   */
  async removeCostCenter(id: string) {
    let result;
    try {
      result = await this.costCenterRepo.delete(id);
    } catch (err) {
      throw new BadRequestException(this.costCenterDeleteErrorMessage(err));
    }
    if (!result.affected) throw new NotFoundException('Centro de resultado não encontrado');
  }

  async removeCostCenters(ids: string[]) {
    const removedIds: string[] = [];
    const failed: { id: string; message: string }[] = [];
    for (const id of ids) {
      try {
        const result = await this.costCenterRepo.delete(id);
        if (result.affected) removedIds.push(id);
        else failed.push({ id, message: 'Centro de resultado não encontrado' });
      } catch (err) {
        failed.push({ id, message: this.costCenterDeleteErrorMessage(err) });
      }
    }
    return { removed: removedIds.length, removedIds, failed };
  }

  private costCenterDeleteErrorMessage(err: unknown): string {
    if (err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23503') {
      return 'Centro de resultado em uso no orçamento — não pode ser excluído.';
    }
    return 'Erro ao excluir centro de resultado';
  }

  findDirectorateByName(name: string) {
    return this.directorateRepo.findOne({ where: { name } });
  }

  findCostCenterByName(name: string) {
    return this.costCenterRepo.findOne({ where: { name } });
  }

  /**
   * Cadastro de centros de custo em massa a partir de uma planilha com as
   * colunas CÓDIGO, CENTRO DE CUSTO e DIRETORIA (a diretoria é opcional —
   * quando informada, é resolvida por nome exato). Rejeita código/nome
   * vazio ou duplicado (na planilha ou já cadastrado) e diretoria
   * informada mas inexistente.
   */
  async importCostCentersFromExcel(buffer: Buffer, filename: string, importedById: string) {
    const batch = await this.importBatchService.create(ImportType.CENTRO_CUSTO, filename, importedById);

    const sheet = await parseExcelSheetRaw(buffer);
    const headers = sheet.headers;

    const colIndex = {
      code: findHeaderIndex(headers, COST_CENTER_HEADER_ALIASES.code),
      name: findHeaderIndex(headers, COST_CENTER_HEADER_ALIASES.name),
      directorate: findHeaderIndex(headers, COST_CENTER_HEADER_ALIASES.directorate),
    };

    if (colIndex.code === -1 || colIndex.name === -1) {
      const missing = [
        colIndex.code === -1 ? 'código' : null,
        colIndex.name === -1 ? 'centro de resultado' : null,
      ].filter(Boolean);
      throw new BadRequestException(
        `Planilha inválida: coluna(s) não encontrada(s): ${missing.join(', ')}. Esperado: CÓDIGO, CENTRO DE RESULTADO, DIRETORIA (opcional).`,
      );
    }

    const existing = await this.findAllCostCenters();
    const existingNames = new Set(existing.map((c) => normalizeLabel(c.name)));
    const existingCodes = new Set(existing.map((c) => normalizeLabel(c.code)));
    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();

    const errors: RowError[] = [];
    const toInsert: Partial<CostCenter>[] = [];

    for (const row of sheet.rows) {
      const code = String(row.values[colIndex.code] ?? '').trim();
      const name = String(row.values[colIndex.name] ?? '').trim();
      const directorateName =
        colIndex.directorate === -1 ? '' : String(row.values[colIndex.directorate] ?? '').trim();

      if (!code) {
        errors.push({ rowNumber: row.rowNumber, field: 'codigo', message: 'Código é obrigatório' });
        continue;
      }
      if (!name) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Nome é obrigatório' });
        continue;
      }
      const codeKey = normalizeLabel(code);
      const nameKey = normalizeLabel(name);
      if (seenCodes.has(codeKey)) {
        errors.push({ rowNumber: row.rowNumber, field: 'codigo', message: `Código duplicado na planilha: ${code}` });
        continue;
      }
      if (existingCodes.has(codeKey)) {
        errors.push({ rowNumber: row.rowNumber, field: 'codigo', message: `Código já cadastrado: ${code}` });
        continue;
      }
      if (seenNames.has(nameKey)) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: `Nome duplicado na planilha: ${name}` });
        continue;
      }
      if (existingNames.has(nameKey)) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: `Centro de resultado já cadastrado: ${name}` });
        continue;
      }

      let directorateId: string | undefined;
      if (directorateName) {
        const directorate = await this.findDirectorateByName(directorateName);
        if (!directorate) {
          errors.push({ rowNumber: row.rowNumber, field: 'diretoria', message: `Diretoria inexistente: ${directorateName}` });
          continue;
        }
        directorateId = directorate.id;
      }

      seenCodes.add(codeKey);
      seenNames.add(nameKey);
      toInsert.push({ code, name, directorateId });
    }

    if (toInsert.length > 0) {
      await this.costCenterRepo.save(this.costCenterRepo.create(toInsert));
    }

    const finished = await this.importBatchService.finish(
      batch.id,
      sheet.rows.length,
      toInsert.length,
      errors,
    );
    return { ...finished, errors };
  }

  async getCostCenterImportBatch(batchId: string) {
    const batch = await this.importBatchService.findOne(batchId);
    const errors = await this.importBatchService.findErrors(batchId);
    return { ...batch, errors };
  }
}
