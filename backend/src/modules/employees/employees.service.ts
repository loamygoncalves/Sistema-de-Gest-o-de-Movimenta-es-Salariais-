import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { EmployeeStatus, ImportType, PlannedSituation } from '../../common/enums';
import { AccessScope } from '../../common/decorators/current-user.decorator';
import { applyAccessScope } from '../../common/utils/access-scope.util';
import { parseExcelBuffer, toDate, toMonthYear, toNumber } from '../../common/utils/excel.util';
import { monthValue } from '../../common/utils/months.util';
import { OrgService } from '../org/org.service';
import { ImportBatchService } from '../imports/import-batch.service';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { Employee } from './entities/employee.entity';
import { PayrollSnapshot } from './entities/payroll-snapshot.entity';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(PayrollSnapshot)
    private readonly payrollSnapshotRepo: Repository<PayrollSnapshot>,
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    private readonly orgService: OrgService,
    private readonly importBatchService: ImportBatchService,
  ) {}

  async findAll(query: EmployeeQueryDto, scope: AccessScope) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.directorate', 'directorate');

    applyAccessScope(qb, 'employee', scope, query.directorateId, query.costCenterId);
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
   * O (year, month) mais recente que já tem fechamento salvo, e o conjunto
   * de colaboradores presentes nele — calculado ANTES de uma nova
   * importação processar suas linhas, para servir de "baseline" de quem
   * estava na folha do último fechamento (ver deactivateMissingEmployees).
   * null se ainda não houve nenhum fechamento.
   */
  private async resolveLatestPayrollSnapshotMonth(): Promise<
    { year: number; month: number; keyNum: number; employeeIds: Set<string> } | null
  > {
    const snapshots = await this.payrollSnapshotRepo.find();
    if (snapshots.length === 0) return null;

    let year = 0;
    let month = 0;
    let keyNum = -1;
    for (const s of snapshots) {
      const thisKeyNum = s.year * 12 + s.month;
      if (thisKeyNum > keyNum) {
        keyNum = thisKeyNum;
        year = s.year;
        month = s.month;
      }
    }
    const employeeIds = new Set(
      snapshots.filter((s) => s.year === year && s.month === month).map((s) => s.employeeId),
    );
    return { year, month, keyNum, employeeIds };
  }

  /**
   * Inativa automaticamente quem estava ATIVO e tinha snapshot no último
   * fechamento anterior, mas não aparece no fechamento novo — sinal de que
   * saiu da empresa entre um mês e outro. Só é chamada quando a importação
   * está avançando o fechamento mais recente (nunca ao reimportar/corrigir
   * um mês antigo), para não mexer no status de quem já foi substituído por
   * um fechamento posterior mais recente.
   */
  private async deactivateMissingEmployees(
    previousLatest: { employeeIds: Set<string> } | null,
    currentEmployeeIds: Set<string>,
  ): Promise<{ id: string; registration: string; name: string }[]> {
    if (!previousLatest) return [];
    const missingIds = [...previousLatest.employeeIds].filter((id) => !currentEmployeeIds.has(id));
    if (missingIds.length === 0) return [];

    const missingEmployees = await this.employeeRepo.find({
      where: { id: In(missingIds), status: EmployeeStatus.ATIVO },
    });
    if (missingEmployees.length === 0) return [];

    await this.employeeRepo.update(
      { id: In(missingEmployees.map((e) => e.id)) },
      { status: EmployeeStatus.INATIVO },
    );
    return missingEmployees.map((e) => ({ id: e.id, registration: e.registration, name: e.name }));
  }

  /**
   * Importa a base de colaboradores a partir de uma planilha Excel — o
   * fechamento mensal da folha (ver payroll-snapshot.entity.ts). Colunas
   * esperadas (normalizadas): matricula, nome, cargo, centro_de_custo,
   * admissao, salario_atual, mes_de_referencia (`MM/AAAA`, ex.: `08/2026` —
   * o mês que está sendo fechado, lido linha a linha, não um parâmetro do
   * arquivo inteiro). A diretoria é derivada do centro de custo informado
   * (não é mais uma coluna própria). Além de atualizar
   * `employees.current_salary`/`employees.cost_center_id` de cada
   * colaborador (como sempre), grava um snapshot em `payroll_snapshots` para
   * o mês daquela linha — reimportar o mesmo (year, month) substitui o
   * snapshot anterior daquele colaborador (idempotente), nunca duplica.
   * Quando este fechamento avança o mês mais recente (não é uma correção de
   * mês antigo), quem estava ATIVO no fechamento anterior e não aparece
   * nesta planilha é automaticamente marcado INATIVO — ver
   * deactivateMissingEmployees.
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
    const previousLatest = await this.resolveLatestPayrollSnapshotMonth();
    const employeeIdsByMonthKey = new Map<string, { keyNum: number; employeeIds: Set<string> }>();

    for (const row of rows) {
      const data = row.data;
      const registration = String(data['matricula'] ?? '').trim();
      const name = String(data['nome'] ?? '').trim();
      const positionName = String(data['cargo'] ?? '').trim();
      const costCenterName = String(data['centro_de_custo'] ?? '').trim();
      const currentSalary = toNumber(data['salario_atual']);
      const admissionDate = toDate(data['admissao']);
      const monthYear = toMonthYear(data['mes_de_referencia']);

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
      if (!costCenterName) {
        errors.push({ rowNumber: row.rowNumber, field: 'centro_de_custo', message: 'Centro de custo é obrigatório' });
        continue;
      }
      const position = await this.orgService.findPositionByName(positionName);
      if (!position) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: `Cargo inexistente: ${positionName}` });
        continue;
      }
      const costCenter = await this.orgService.findCostCenterByName(costCenterName);
      if (!costCenter) {
        errors.push({ rowNumber: row.rowNumber, field: 'centro_de_custo', message: `Centro de custo inexistente: ${costCenterName}` });
        continue;
      }
      if (!costCenter.directorateId) {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'centro_de_custo',
          message: `Centro de custo "${costCenterName}" não tem diretoria vinculada — cadastre a diretoria dele em Administração > Estrutura Organizacional antes de importar`,
        });
        continue;
      }
      if (currentSalary === null || currentSalary < 0) {
        errors.push({ rowNumber: row.rowNumber, field: 'salario_atual', message: 'Salário atual inválido' });
        continue;
      }
      if (!admissionDate) {
        errors.push({ rowNumber: row.rowNumber, field: 'admissao', message: 'Data de admissão inválida' });
        continue;
      }
      if (!monthYear) {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'mes_de_referencia',
          message: 'Mês de referência inválido — use o formato MM/AAAA (ex.: 08/2026)',
        });
        continue;
      }

      seenRegistrations.add(registration);

      const existing = await this.employeeRepo.findOne({ where: { registration } });

      const payload = {
        registration,
        name,
        positionId: position.id,
        directorateId: costCenter.directorateId,
        costCenterId: costCenter.id,
        currentSalary,
        admissionDate: admissionDate.toISOString().slice(0, 10),
        status: existing?.status ?? EmployeeStatus.ATIVO,
        lastImportBatchId: batch.id,
      };

      let employeeId: string;
      if (existing) {
        await this.employeeRepo.update(existing.id, payload);
        employeeId = existing.id;
      } else {
        const created = await this.employeeRepo.save(this.employeeRepo.create(payload));
        employeeId = created.id;
      }

      const existingSnapshot = await this.payrollSnapshotRepo.findOne({
        where: { year: monthYear.year, month: monthYear.month, employeeId },
      });
      const snapshotPayload = {
        year: monthYear.year,
        month: monthYear.month,
        employeeId,
        directorateId: costCenter.directorateId,
        costCenterId: costCenter.id,
        positionId: position.id,
        salary: currentSalary,
        importBatchId: batch.id,
      };
      if (existingSnapshot) {
        await this.payrollSnapshotRepo.update(existingSnapshot.id, snapshotPayload);
      } else {
        await this.payrollSnapshotRepo.save(this.payrollSnapshotRepo.create(snapshotPayload));
      }

      const monthKey = `${monthYear.year}-${monthYear.month}`;
      const group = employeeIdsByMonthKey.get(monthKey) ?? {
        keyNum: monthYear.year * 12 + monthYear.month,
        employeeIds: new Set<string>(),
      };
      group.employeeIds.add(employeeId);
      employeeIdsByMonthKey.set(monthKey, group);

      successRows += 1;
    }

    let deactivated: { id: string; registration: string; name: string }[] = [];
    let newestGroup: { keyNum: number; employeeIds: Set<string> } | null = null;
    for (const group of employeeIdsByMonthKey.values()) {
      if (!newestGroup || group.keyNum > newestGroup.keyNum) newestGroup = group;
    }
    if (newestGroup && (!previousLatest || newestGroup.keyNum > previousLatest.keyNum)) {
      deactivated = await this.deactivateMissingEmployees(previousLatest, newestGroup.employeeIds);
    }

    const finished = await this.importBatchService.finish(batch.id, rows.length, successRows, errors);
    return { ...finished, errors, deactivated };
  }

  async getImportBatch(batchId: string) {
    const batch = await this.importBatchService.findOne(batchId);
    const errors = await this.importBatchService.findErrors(batchId);
    return { ...batch, errors };
  }

  /**
   * Folha "daquele mês": usa exclusivamente os salários congelados em
   * payroll_snapshots para year+month (dentro do escopo) — nunca o salário
   * atual ao vivo. Sem fechamento para esse mês, devolve `monthClosed: false`
   * e lista vazia — mostrar o salário atual (que reflete o ÚLTIMO mês
   * fechado, não necessariamente o mês pedido) faria um mês sem fechamento
   * "herdar" os números de outro mês, como se as folhas tivessem sido
   * somadas/duplicadas entre meses.
   */
  private async resolveMonthlySalaryRows(
    year: number,
    month: number,
    scope: AccessScope,
    directorateId?: string,
    costCenterId?: string,
  ): Promise<{
    rows: { directorateId: string; directorateName?: string; costCenterId?: string; salary: number }[];
    monthClosed: boolean;
  }> {
    const snapshotQb = this.payrollSnapshotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.directorate', 'directorate')
      .where('s.year = :year', { year })
      .andWhere('s.month = :month', { month });
    applyAccessScope(snapshotQb, 's', scope, directorateId, costCenterId);
    const snapshots = await snapshotQb.getMany();
    if (snapshots.length === 0) {
      return { rows: [], monthClosed: false };
    }
    return {
      rows: snapshots.map((s) => ({
        directorateId: s.directorateId,
        directorateName: s.directorate?.name,
        costCenterId: s.costCenterId,
        salary: Number(s.salary),
      })),
      monthClosed: true,
    };
  }

  /**
   * Compara a base atual de colaboradores com o orçamento de um mês do ano
   * informado. O orçamento não é vinculado a colaborador — a comparação é
   * sempre feita por centro de custo (nunca por cargo): quantas vagas
   * orçadas existem naquele mês para o centro de custo x quantos
   * colaboradores ativos ocupam esse mesmo centro de custo hoje. Bucketar
   * por cargo faria um cargo estourado e outro com sobra no mesmo centro de
   * custo aparecerem como dois problemas separados (excesso de HC aqui,
   * vaga aberta ali) em vez de simplesmente se cancelarem.
   */
  async compareWithBudget(year: number, month: number | undefined, scope: AccessScope) {
    const referenceMonth = month ?? new Date().getMonth() + 1;

    const budgetQb = this.budgetRepo
      .createQueryBuilder('b')
      .where('b.year = :year', { year });
    applyAccessScope(budgetQb, 'b', scope);
    const allBudgetEntries = await budgetQb.getMany();
    const budgetEntries = allBudgetEntries.filter(
      (entry) => monthValue(entry as any, referenceMonth) !== null,
    );

    const { rows: salaryRows, monthClosed } = await this.resolveMonthlySalaryRows(year, referenceMonth, scope);

    type Bucket = {
      directorateId: string;
      directorateName?: string;
      costCenterId: string;
      costCenterName?: string;
      budgetedCount: number;
      budgetedCost: number;
      currentCount: number;
      currentCost: number;
    };
    const buckets = new Map<string, Bucket>();
    const bucketKey = (directorateId: string, costCenterId: string) => `${directorateId}|${costCenterId}`;

    for (const entry of budgetEntries) {
      const key = bucketKey(entry.directorateId, entry.costCenterId);
      const bucket = buckets.get(key) ?? {
        directorateId: entry.directorateId,
        directorateName: entry.directorate?.name,
        costCenterId: entry.costCenterId,
        costCenterName: entry.costCenter?.name,
        budgetedCount: 0,
        budgetedCost: 0,
        currentCount: 0,
        currentCost: 0,
      };
      bucket.budgetedCount += 1;
      bucket.budgetedCost += Number(monthValue(entry as any, referenceMonth) ?? 0);
      buckets.set(key, bucket);
    }

    for (const row of salaryRows) {
      if (!row.costCenterId) continue;
      const key = bucketKey(row.directorateId, row.costCenterId);
      const bucket = buckets.get(key) ?? {
        directorateId: row.directorateId,
        directorateName: row.directorateName,
        costCenterId: row.costCenterId,
        budgetedCount: 0,
        budgetedCost: 0,
        currentCount: 0,
        currentCost: 0,
      };
      bucket.currentCount += 1;
      bucket.currentCost += row.salary;
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
      hcCurrent: salaryRows.length,
      openPositions,
      headcountExcess,
      budgetSavings,
      budgetOverrun,
      movementsByType,
      items,
      monthClosed,
    };
  }
}
