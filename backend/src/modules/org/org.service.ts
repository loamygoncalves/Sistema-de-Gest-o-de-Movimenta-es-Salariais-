import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportType } from '../../common/enums';
import { parseExcelSheetRaw } from '../../common/utils/excel.util';
import { ImportBatchService, RowError } from '../imports/import-batch.service';
import { Directorate } from './entities/directorate.entity';
import { Management } from './entities/management.entity';
import { Coordination } from './entities/coordination.entity';
import { Position } from './entities/position.entity';
import { CostCenter } from './entities/cost-center.entity';
import {
  CreateCoordinationDto,
  CreateCostCenterDto,
  CreateDirectorateDto,
  CreateManagementDto,
  CreatePositionDto,
  UpdateDirectorateDto,
  UpdatePositionDto,
} from './dto/org.dto';

/** Cabeçalhos aceitos (normalizados) para a coluna de nome na planilha de import. */
const NAME_HEADER_ALIASES = ['NOME', 'CENTRO DE CUSTO', 'CENTRO_DE_CUSTO', 'CENTROS DE CUSTO'];

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Gera um código único a partir do nome (planilha traz só o nome, mas o
 * cadastro exige um `code` único) — normaliza para ASCII maiúsculo,
 * substitui não-alfanuméricos por "_" e desambigua com sufixo numérico
 * contra os códigos já usados (existentes + já gerados nesta importação).
 */
function generateCostCenterCode(name: string, usedCodes: Set<string>): string {
  const base = normalizeLabel(name)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45) || 'CC';
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${base}_${suffix}`.slice(0, 50);
    suffix += 1;
  }
  return code;
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

  // Cargos
  findAllPositions() {
    return this.positionRepo.find({ order: { name: 'ASC' } });
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

  findDirectorateByName(name: string) {
    return this.directorateRepo.findOne({ where: { name } });
  }

  findCostCenterByName(name: string) {
    return this.costCenterRepo.findOne({ where: { name } });
  }

  /**
   * Cadastro de centros de custo em massa a partir de uma planilha contendo
   * apenas os nomes (uma coluna). Aceita um cabeçalho reconhecido (NOME,
   * CENTRO DE CUSTO, ...) na primeira linha; se a primeira linha não bater
   * com nenhum alias conhecido, ela é tratada como já sendo a primeira linha
   * de dados (planilha sem cabeçalho). O `code` — exigido pelo cadastro mas
   * ausente na planilha — é gerado a partir do nome.
   */
  async importCostCentersFromExcel(buffer: Buffer, filename: string, importedById: string) {
    const batch = await this.importBatchService.create(ImportType.CENTRO_CUSTO, filename, importedById);

    const sheet = await parseExcelSheetRaw(buffer);
    const firstColumnHeader = sheet.headers[1];
    const hasRecognizedHeader = NAME_HEADER_ALIASES.includes(normalizeLabel(firstColumnHeader));
    const dataRows = hasRecognizedHeader
      ? sheet.rows
      : [{ rowNumber: 1, values: sheet.headers }, ...sheet.rows];

    const existing = await this.findAllCostCenters();
    const existingNames = new Set(existing.map((c) => normalizeLabel(c.name)));
    const usedCodes = new Set(existing.map((c) => c.code));
    const seenInFile = new Set<string>();

    const errors: RowError[] = [];
    const toInsert: Partial<CostCenter>[] = [];

    for (const row of dataRows) {
      const name = String(row.values[1] ?? '').trim();
      if (!name) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Nome é obrigatório' });
        continue;
      }
      const key = normalizeLabel(name);
      if (seenInFile.has(key)) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: `Nome duplicado na planilha: ${name}` });
        continue;
      }
      if (existingNames.has(key)) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: `Centro de custo já cadastrado: ${name}` });
        continue;
      }
      seenInFile.add(key);
      const code = generateCostCenterCode(name, usedCodes);
      usedCodes.add(code);
      toInsert.push({ code, name });
    }

    if (toInsert.length > 0) {
      await this.costCenterRepo.save(this.costCenterRepo.create(toInsert));
    }

    const finished = await this.importBatchService.finish(
      batch.id,
      dataRows.length,
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
