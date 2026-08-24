import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { EmployeeStatus, ImportType, PlannedSituation } from '../../common/enums';
import { parseExcelBuffer, toDate, toNumber } from '../../common/utils/excel.util';
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
   * Compara a base atual de colaboradores com o orçamento do ano informado,
   * casando registros por matrícula.
   */
  async compareWithBudget(year: number, scopedDirectorateId?: string) {
    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    if (scopedDirectorateId) budgetQb.andWhere('b.directorateId = :d', { d: scopedDirectorateId });
    const budgetEntries = await budgetQb.getMany();

    const employeeQb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.position', 'position')
      .leftJoinAndSelect('e.directorate', 'directorate');
    if (scopedDirectorateId) employeeQb.andWhere('e.directorateId = :d', { d: scopedDirectorateId });
    const employees = await employeeQb.getMany();

    const employeesByRegistration = new Map(employees.map((e) => [e.registration, e]));
    const budgetByRegistration = new Map(
      budgetEntries.filter((b) => b.registration).map((b) => [b.registration as string, b]),
    );

    let promotionsDone = 0;
    let promotionsPending = 0;
    let budgetSavings = 0;
    let budgetOverrun = 0;
    const items: any[] = [];

    for (const budget of budgetEntries) {
      const employee = budget.registration ? employeesByRegistration.get(budget.registration) : undefined;

      if (budget.plannedSituation === PlannedSituation.NOVA_VAGA) {
        items.push({
          type: 'VAGA_ABERTA',
          registration: budget.registration,
          name: budget.name,
          position: budget.position?.name,
          directorate: budget.directorate?.name,
          plannedSalary: budget.plannedSalary,
        });
        continue;
      }

      if (!employee) continue;

      if (budget.plannedSituation === PlannedSituation.PROMOCAO) {
        if (employee.currentSalary >= budget.plannedSalary) {
          promotionsDone += 1;
        } else {
          promotionsPending += 1;
          items.push({
            type: 'PROMOCAO_PENDENTE',
            registration: employee.registration,
            name: employee.name,
            currentSalary: employee.currentSalary,
            plannedSalary: budget.plannedSalary,
          });
        }
      }

      const diff = budget.currentSalary - employee.currentSalary;
      if (diff > 0) budgetSavings += diff;
      if (diff < 0) budgetOverrun += Math.abs(diff);
    }

    const openPositions = budgetEntries.filter(
      (b) => b.plannedSituation === PlannedSituation.NOVA_VAGA,
    ).length;

    const headcountExcess = Math.max(0, employees.length - budgetEntries.length);

    return {
      hcBudgeted: budgetEntries.length,
      hcCurrent: employees.length,
      promotionsDone,
      promotionsPending,
      openPositions,
      headcountExcess,
      budgetSavings,
      budgetOverrun,
      items,
    };
  }
}
