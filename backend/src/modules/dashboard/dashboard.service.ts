import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovementStatus, MovementType, PlannedSituation } from '../../common/enums';
import { monthValue } from '../../common/utils/months.util';
import { Employee } from '../employees/entities/employee.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { Directorate } from '../org/entities/directorate.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    @InjectRepository(Directorate)
    private readonly directorateRepo: Repository<Directorate>,
    @InjectRepository(MovementRequest)
    private readonly movementRepo: Repository<MovementRequest>,
    @InjectRepository(MovementSimulation)
    private readonly simulationRepo: Repository<MovementSimulation>,
    @InjectRepository(MovementHistory)
    private readonly historyRepo: Repository<MovementHistory>,
  ) {}

  async getHeadcount(year: number, month: number | undefined, directorateId?: string) {
    const referenceMonth = month ?? new Date().getMonth() + 1;

    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    if (directorateId) budgetQb.andWhere('b.directorateId = :d', { d: directorateId });
    const allBudgetEntries = await budgetQb.getMany();
    const budgetEntries = allBudgetEntries.filter(
      (entry) => monthValue(entry as any, referenceMonth) !== null,
    );

    const employeeQb = this.employeeRepo.createQueryBuilder('e');
    if (directorateId) employeeQb.andWhere('e.directorateId = :d', { d: directorateId });
    const hcCurrent = await employeeQb.getCount();

    const approvedIncreaseQb = this.movementRepo
      .createQueryBuilder('m')
      .where('m.type = :type', { type: MovementType.AUMENTO_QUADRO })
      .andWhere('m.status = :status', { status: MovementStatus.APROVADO })
      .andWhere('EXTRACT(YEAR FROM m.effectiveDate) = :year', { year });
    if (directorateId) approvedIncreaseQb.andWhere('m.directorateId = :d', { d: directorateId });
    const approvedIncreases = await approvedIncreaseQb.getMany();
    const hcApproved = approvedIncreases.reduce((sum, m) => sum + Number(m.quantity ?? 0), 0);

    const openPositions = budgetEntries.filter(
      (b) => b.movementType === PlannedSituation.AUMENTO_DE_QUADRO,
    ).length;
    const hcOpen = Math.max(0, openPositions - hcApproved);

    return {
      year,
      month: referenceMonth,
      hcBudgeted: budgetEntries.length,
      hcCurrent,
      hcApproved,
      hcOpen,
    };
  }

  async getPayroll(year: number, month: number | undefined, directorateId?: string) {
    const referenceMonth = month ?? new Date().getMonth() + 1;

    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    if (directorateId) budgetQb.andWhere('b.directorateId = :d', { d: directorateId });
    const allBudgetEntries = await budgetQb.getMany();
    const budgetEntries = allBudgetEntries.filter(
      (entry) => monthValue(entry as any, referenceMonth) !== null,
    );

    const employeeQb = this.employeeRepo.createQueryBuilder('e');
    if (directorateId) employeeQb.andWhere('e.directorateId = :d', { d: directorateId });
    const employees = await employeeQb.getMany();

    const payrollBudgeted = budgetEntries.reduce(
      (sum, b) => sum + Number(monthValue(b as any, referenceMonth) ?? 0),
      0,
    );
    const payrollCurrent = employees.reduce((sum, e) => sum + Number(e.currentSalary || 0), 0);

    return {
      year,
      month: referenceMonth,
      payrollCurrent,
      payrollBudgeted,
      difference: payrollCurrent - payrollBudgeted,
    };
  }

  async getMovements(year: number, directorateId?: string) {
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .where('EXTRACT(YEAR FROM m.effectiveDate) = :year', { year });
    if (directorateId) qb.andWhere('m.directorateId = :d', { d: directorateId });
    const movements = await qb.getMany();

    return {
      promotions: movements.filter((m) => m.type === MovementType.PROMOCAO).length,
      merits: movements.filter((m) => m.type === MovementType.MERITO).length,
      headcountIncrease: movements.filter((m) => m.type === MovementType.AUMENTO_QUADRO).length,
      transfers: movements.filter((m) => m.type === MovementType.TRANSFERENCIA).length,
    };
  }

  async getFinancial(year: number, month: number | undefined, directorateId?: string) {
    const historyQb = this.historyRepo
      .createQueryBuilder('h')
      .where('EXTRACT(YEAR FROM h.effectiveDate) = :year', { year });
    if (directorateId) historyQb.andWhere('h.directorateId = :d', { d: directorateId });
    const historyRecords = await historyQb.getMany();

    const monthlyImpact = historyRecords.reduce((sum, h) => sum + Number(h.monthlyImpact || 0), 0);
    const annualImpact = historyRecords.reduce((sum, h) => sum + Number(h.annualImpact || 0), 0);

    const payroll = await this.getPayroll(year, month, directorateId);
    const budgetConsumedPercent =
      payroll.payrollBudgeted > 0 ? (payroll.payrollCurrent / payroll.payrollBudgeted) * 100 : 0;

    const projection12Months = await this.getProjection12Months(directorateId);
    const directorateRanking = await this.getDirectorateRanking();

    return {
      monthlyImpact,
      annualImpact,
      budgetConsumedPercent: Number(budgetConsumedPercent.toFixed(2)),
      projection12Months,
      directorateRanking,
    };
  }

  private async getProjection12Months(directorateId?: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 12, 0);

    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoin(
        MovementSimulation,
        'sim',
        'sim.movementRequestId = m.id AND sim.createdAt = (SELECT MAX(s2."created_at") FROM movement_simulations s2 WHERE s2."movement_request_id" = m.id)',
      )
      .select('m.effectiveDate', 'effectiveDate')
      .addSelect('sim.totalMonthlyImpact', 'impact')
      .where('m.status IN (:...statuses)', {
        statuses: [
          MovementStatus.APROVADO,
          MovementStatus.PENDENTE_DIRETOR,
          MovementStatus.PENDENTE_RH,
          MovementStatus.PENDENTE_FINANCEIRO,
        ],
      })
      .andWhere('m.effectiveDate BETWEEN :start AND :end', {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });
    if (directorateId) qb.andWhere('m.directorateId = :d', { d: directorateId });

    const rows = await qb.getRawMany();

    const byMonth = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      byMonth.set(date.toISOString().slice(0, 7), 0);
    }
    for (const row of rows) {
      const month = new Date(row.effectiveDate).toISOString().slice(0, 7);
      if (byMonth.has(month)) {
        byMonth.set(month, byMonth.get(month)! + Number(row.impact ?? 0));
      }
    }

    return Array.from(byMonth.entries()).map(([month, impact]) => ({ month, impact }));
  }

  private async getDirectorateRanking() {
    const directorates = await this.directorateRepo.find();
    const employees = await this.employeeRepo.find();

    const payrollByDirectorate = new Map<string, number>();
    for (const employee of employees) {
      payrollByDirectorate.set(
        employee.directorateId,
        (payrollByDirectorate.get(employee.directorateId) ?? 0) + Number(employee.currentSalary || 0) * 12,
      );
    }

    return directorates
      .map((d) => {
        const currentPayroll = payrollByDirectorate.get(d.id) ?? 0;
        const consumedPercent = Number(d.annualBudget) > 0 ? (currentPayroll / Number(d.annualBudget)) * 100 : 0;
        return {
          directorate: d.name,
          currentPayroll,
          annualBudget: Number(d.annualBudget),
          consumedPercent: Number(consumedPercent.toFixed(2)),
        };
      })
      .sort((a, b) => b.consumedPercent - a.consumedPercent);
  }
}
