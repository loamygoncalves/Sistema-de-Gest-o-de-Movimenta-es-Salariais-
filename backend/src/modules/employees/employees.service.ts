import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { EmployeeStatus, ImportType, PlannedSituation } from '../../common/enums';
import { parseExcelBuffer, toDate, toNumber } from '../../common/utils/excel.util';
import { monthValue } from '../../common/utils/months.util';
import { OrgService } from '../org/org.service';
import { ImportBatchService } from '../imports/import-batch.service';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    private readonly orgService: OrgService,
    private readonly importBatchService: ImportBatchService,
  ) {}

  async findAll(query: EmployeeQueryDto, scopedDirectorateId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.directorate', 'directorate');

    const directorateId = scopedDirectorateId ?? query.directorateId;
    if (directorateId) qb.andWhere('employee.directorateId = :directorateId', { directorateId });
    if (query.positionId) qb.andWhere('employee.positionId = :positionId', { positionId: query.positionId });
    if (query.status) qb.andWhere('employee.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere('(employee.name ILIKE :search OR employee.registration ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('employee.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existing = await this.employeeRepo.findOne({ where: { registration: dto.registration } });
    if (existing) throw new BadRequestException('Já existe um colaborador com esta matrícula');
    return this.employeeRepo.save(this.employeeRepo.create(dto as unknown as Employee));
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    await this.findOne(id);
    await this.employeeRepo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.employeeRepo.update(id, { status: EmployeeStatus.INATIVO });
  }

  /**
   * Importa a base atual de colaboradores a partir de uma planilha Excel.
   * Colunas esperadas (normalizadas): matricula, nome, cargo, diretoria,
   * gerencia, coordenacao, centro_de_custo, cidade, estado, tipo_contrato,
   * data_admissao, salario_atual, status.
   */
  async importFromExcel(buffer: Buffer, filename: string, importedById: string) {
    const batch = await this.importBatchService.create(
      ImportType.BASE_COLABORADORES,
      filename,
      importedById,
    );

    const rows = await parseExcelBuffer(buffer);
    const errors: { rowNumber: number; field?: string; message: string }[] = [];
    let successRows = 0;

    const seenRegistrations = new Set<string>();

    for (const row of rows) {
      const data = row.data;
      const registration = String(data['matricula'] ?? '').trim();
      const name = String(data['nome'] ?? '').trim();
      const positionName = String(data['cargo'] ?? '').trim();
      const directorateName = String(data['diretoria'] ?? '').trim();
      const currentSalary = toNumber(data['salario_atual']);
      const admissionDate = toDate(data['data_admissao']);

      if (!registration) {
        errors.push({ rowNumber: row.rowNumber, field: 'matricula', message: 'Matrícula é obrigatória' });
        continue;
      }
      if (seenRegistrations.has(registration)) {
        errors.push({ rowNumber: row.rowNumber, field: 'matricula', message: `Matrícula duplicada na planilha: ${registration}` });
        continue;
      }
      if (!name) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Nome é obrigatório' });
        continue;
      }
      if (!positionName) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: 'Cargo é obrigatório' });
        continue;
      }
      if (!directorateName) {
        errors.push({ rowNumber: row.rowNumber, field: 'diretoria', message: 'Diretoria é obrigatória' });
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
      if (currentSalary === null || currentSalary < 0) {
        errors.push({ rowNumber: row.rowNumber, field: 'salario_atual', message: 'Salário atual inválido' });
        continue;
      }
      if (!admissionDate) {
        errors.push({ rowNumber: row.rowNumber, field: 'data_admissao', message: 'Data de admissão inválida' });
        continue;
      }

      seenRegistrations.add(registration);

      const existing = await this.employeeRepo.findOne({ where: { registration } });
      const statusRaw = String(data['status'] ?? 'ATIVO').trim().toUpperCase();
      const status = Object.values(EmployeeStatus).includes(statusRaw as EmployeeStatus)
        ? (statusRaw as EmployeeStatus)
        : EmployeeStatus.ATIVO;

      const payload = {
        registration,
        name,
        positionId: position.id,
        directorateId: directorate.id,
        currentSalary,
        admissionDate: admissionDate.toISOString().slice(0, 10),
        status,
        lastImportBatchId: batch.id,
      };

      if (existing) {
        await this.employeeRepo.update(existing.id, payload);
      } else {
        await this.employeeRepo.save(this.employeeRepo.create(payload));
      }
      successRows += 1;
    }

    return this.importBatchService.finish(batch.id, rows.length, successRows, errors);
  }

  async getImportBatch(batchId: string) {
    const batch = await this.importBatchService.findOne(batchId);
    const errors = await this.importBatchService.findErrors(batchId);
    return { ...batch, errors };
  }

  /**
   * Compara a base atual de colaboradores com o orçamento de um mês do ano
   * informado. O orçamento não é vinculado a colaborador — a comparação é
   * feita por "bucket" (diretoria + centro de custo + cargo): quantas vagas
   * orçadas existem naquele mês para o bucket x quantos colaboradores ativos
   * ocupam esse mesmo bucket hoje.
   */
  async compareWithBudget(year: number, month: number | undefined, scopedDirectorateId?: string) {
    const referenceMonth = month ?? new Date().getMonth() + 1;

    const budgetQb = this.budgetRepo
      .createQueryBuilder('b')
      .where('b.year = :year', { year });
    if (scopedDirectorateId) budgetQb.andWhere('b.directorateId = :d', { d: scopedDirectorateId });
    const allBudgetEntries = await budgetQb.getMany();
    const budgetEntries = allBudgetEntries.filter(
      (entry) => monthValue(entry as any, referenceMonth) !== null,
    );

    const employeeQb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.position', 'position')
      .leftJoinAndSelect('e.directorate', 'directorate')
      .where('e.status = :status', { status: EmployeeStatus.ATIVO });
    if (scopedDirectorateId) employeeQb.andWhere('e.directorateId = :d', { d: scopedDirectorateId });
    const employees = await employeeQb.getMany();

    type Bucket = {
      directorateId: string;
      directorateName?: string;
      costCenterId: string;
      costCenterName?: string;
      positionId: string;
      positionName?: string;
      budgetedCount: number;
      budgetedCost: number;
      currentCount: number;
      currentCost: number;
    };
    const buckets = new Map<string, Bucket>();
    const bucketKey = (directorateId: string, costCenterId: string, positionId: string) =>
      `${directorateId}|${costCenterId}|${positionId}`;

    for (const entry of budgetEntries) {
      const key = bucketKey(entry.directorateId, entry.costCenterId, entry.positionId);
      const bucket = buckets.get(key) ?? {
        directorateId: entry.directorateId,
        directorateName: entry.directorate?.name,
        costCenterId: entry.costCenterId,
        costCenterName: entry.costCenter?.name,
        positionId: entry.positionId,
        positionName: entry.position?.name,
        budgetedCount: 0,
        budgetedCost: 0,
        currentCount: 0,
        currentCost: 0,
      };
      bucket.budgetedCount += 1;
      bucket.budgetedCost += Number(monthValue(entry as any, referenceMonth) ?? 0);
      buckets.set(key, bucket);
    }

    for (const employee of employees) {
      if (!employee.costCenterId) continue;
      const key = bucketKey(employee.directorateId, employee.costCenterId, employee.positionId);
      const bucket = buckets.get(key) ?? {
        directorateId: employee.directorateId,
        directorateName: employee.directorate?.name,
        costCenterId: employee.costCenterId,
        positionId: employee.positionId,
        positionName: employee.position?.name,
        budgetedCount: 0,
        budgetedCost: 0,
        currentCount: 0,
        currentCost: 0,
      };
      bucket.currentCount += 1;
      bucket.currentCost += Number(employee.currentSalary || 0);
      buckets.set(key, bucket);
    }

    let openPositions = 0;
    let headcountExcess = 0;
    let budgetSavings = 0;
    let budgetOverrun = 0;
    const items: any[] = [];

    for (const bucket of buckets.values()) {
      const countDiff = bucket.budgetedCount - bucket.currentCount;
      if (countDiff > 0) openPositions += countDiff;
      if (countDiff < 0) headcountExcess += Math.abs(countDiff);

      const costDiff = bucket.budgetedCost - bucket.currentCost;
      if (costDiff > 0) budgetSavings += costDiff;
      if (costDiff < 0) budgetOverrun += Math.abs(costDiff);

      if (countDiff !== 0) {
        items.push({
          type: countDiff > 0 ? 'VAGA_ABERTA' : 'EXCESSO_HC',
          directorate: bucket.directorateName,
          costCenter: bucket.costCenterName,
          position: bucket.positionName,
          budgetedCount: bucket.budgetedCount,
          currentCount: bucket.currentCount,
          budgetedCost: bucket.budgetedCost,
          currentCost: bucket.currentCost,
        });
      }
    }

    const movementsByType = Object.values(PlannedSituation).reduce(
      (acc, type) => {
        acc[type] = budgetEntries.filter((entry) => entry.movementType === type).length;
        return acc;
      },
      {} as Record<PlannedSituation, number>,
    );

    return {
      year,
      month: referenceMonth,
      hcBudgeted: budgetEntries.length,
      hcCurrent: employees.length,
      openPositions,
      headcountExcess,
      budgetSavings,
      budgetOverrun,
      movementsByType,
      items,
    };
  }
}
