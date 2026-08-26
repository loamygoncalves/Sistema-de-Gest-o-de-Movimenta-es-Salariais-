import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MovementStatus, MovementType, PlannedSituation } from '../../common/enums';
import { AccessScope } from '../../common/decorators/current-user.decorator';
import { applyAccessScope } from '../../common/utils/access-scope.util';
import { monthValue } from '../../common/utils/months.util';
import { PayrollSnapshot } from '../employees/entities/payroll-snapshot.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { Directorate } from '../org/entities/directorate.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(PayrollSnapshot)
    private readonly payrollSnapshotRepo: Repository<PayrollSnapshot>,
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

  /** Meses efetivos para um filtro opcional: os informados, ou só o mês corrente. */
  private resolveMonths(months?: number[]): number[] {
    return months && months.length > 0 ? months : [new Date().getMonth() + 1];
  }

  /**
   * Folha "daqueles meses": usa exclusivamente os salários congelados em
   * payroll_snapshots para year+month (dentro do escopo) — nunca o salário
   * atual ao vivo (ver EmployeesService#importFromExcel). Sem fechamento
   * para um mês, ele entra como `monthClosed: false` e lista vazia — usar o
   * salário atual (que reflete o ÚLTIMO mês fechado, não necessariamente o
   * mês pedido) faria um mês sem fechamento "herdar" os números de outro
   * mês, como se as folhas tivessem sido somadas/duplicadas entre meses.
   * Devolve um mapa por mês para permitir tanto a soma (folha/custo, que é
   * aditiva) quanto a média (headcount, que não é) entre os meses do filtro.
   */
  private async resolveMonthlySalariesByMonth(
    year: number,
    months: number[],
    scope: AccessScope,
    directorateId?: string,
    costCenterId?: string,
  ): Promise<Map<number, { salaries: number[]; monthClosed: boolean }>> {
    const snapshotQb = this.payrollSnapshotRepo
      .createQueryBuilder('s')
      .where('s.year = :year', { year })
      .andWhere('s.month IN (:...months)', { months });
    applyAccessScope(snapshotQb, 's', scope, directorateId, costCenterId);
    const snapshots = await snapshotQb.getMany();

    const byMonth = new Map<number, { salaries: number[]; monthClosed: boolean }>();
    for (const month of months) {
      const monthSnapshots = snapshots.filter((s) => s.month === month);
      byMonth.set(month, {
        salaries: monthSnapshots.map((s) => Number(s.salary)),
        monthClosed: monthSnapshots.length > 0,
      });
    }
    return byMonth;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  async getHeadcount(
    year: number,
    months: number[] | undefined,
    scope: AccessScope,
    directorateId?: string,
    costCenterId?: string,
  ) {
    const referenceMonths = this.resolveMonths(months);

    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    applyAccessScope(budgetQb, 'b', scope, directorateId, costCenterId);
    const allBudgetEntries = await budgetQb.getMany();

    const salariesByMonth = await this.resolveMonthlySalariesByMonth(
      year,
      referenceMonths,
      scope,
      directorateId,
      costCenterId,
    );

    const approvedIncreaseQb = this.movementRepo
      .createQueryBuilder('m')
      .where('m.type = :type', { type: MovementType.AUMENTO_QUADRO })
      .andWhere('m.status = :status', { status: MovementStatus.APROVADO })
      .andWhere('EXTRACT(YEAR FROM m.effectiveDate) = :year', { year });
    applyAccessScope(approvedIncreaseQb, 'm', scope, directorateId, costCenterId);
    const approvedIncreases = await approvedIncreaseQb.getMany();
    const hcApproved = approvedIncreases.reduce((sum, m) => sum + Number(m.quantity ?? 0), 0);

    const byMonth = referenceMonths.map((month) => {
      const budgetEntries = allBudgetEntries.filter((entry) => monthValue(entry as any, month) !== null);
      const openPositions = budgetEntries.filter(
        (b) => b.movementType === PlannedSituation.AUMENTO_DE_QUADRO,
      ).length;
      const monthly = salariesByMonth.get(month)!;
      return {
        month,
        hcBudgeted: budgetEntries.length,
        hcCurrent: monthly.salaries.length,
        hcOpen: Math.max(0, openPositions - hcApproved),
        monthClosed: monthly.monthClosed,
      };
    });

    const openMonths = byMonth.filter((m) => !m.monthClosed).map((m) => m.month);

    return {
      year,
      months: referenceMonths,
      hcBudgeted: this.average(byMonth.map((m) => m.hcBudgeted)),
      hcCurrent: this.average(byMonth.map((m) => m.hcCurrent)),
      hcApproved,
      hcOpen: this.average(byMonth.map((m) => m.hcOpen)),
      monthClosed: openMonths.length === 0,
      openMonths,
      byMonth,
    };
  }

  async getPayroll(
    year: number,
    months: number[] | undefined,
    scope: AccessScope,
    directorateId?: string,
    costCenterId?: string,
  ) {
    const referenceMonths = this.resolveMonths(months);

    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    applyAccessScope(budgetQb, 'b', scope, directorateId, costCenterId);
    const allBudgetEntries = await budgetQb.getMany();

    const salariesByMonth = await this.resolveMonthlySalariesByMonth(
      year,
      referenceMonths,
      scope,
      directorateId,
      costCenterId,
    );

    const byMonth = referenceMonths.map((month) => {
      const budgeted = allBudgetEntries.reduce((sum, b) => sum + Number(monthValue(b as any, month) ?? 0), 0);
      const monthly = salariesByMonth.get(month)!;
      const current = monthly.salaries.reduce((sum, salary) => sum + salary, 0);
      return { month, payrollBudgeted: budgeted, payrollCurrent: current, monthClosed: monthly.monthClosed };
    });

    const openMonths = byMonth.filter((m) => !m.monthClosed).map((m) => m.month);
    const payrollBudgeted = byMonth.reduce((sum, m) => sum + m.payrollBudgeted, 0);
    const payrollCurrent = byMonth.reduce((sum, m) => sum + m.payrollCurrent, 0);

    return {
      year,
      months: referenceMonths,
      payrollCurrent,
      payrollBudgeted,
      difference: payrollCurrent - payrollBudgeted,
      monthClosed: openMonths.length === 0,
      openMonths,
      byMonth,
    };
  }

  /**
   * Orçado x Atual por centro de custo, somando/mediando os meses do
   * filtro — é a visão que permite a uma diretoria enxergar exatamente
   * quais dos seus centros de custo estão dentro ou fora do orçamento no
   * período escolhido (não só um mês isolado). Custo é somado entre os
   * meses (gasto acumulado do período); headcount é a média (não é
   * aditivo). `status` marca ACIMA quando o custo atual supera o orçado.
   */
  async getCostCenterBreakdown(
    year: number,
    months: number[] | undefined,
    scope: AccessScope,
    directorateId?: string,
  ) {
    const referenceMonths = this.resolveMonths(months);

    const budgetQb = this.budgetRepo.createQueryBuilder('b').where('b.year = :year', { year });
    applyAccessScope(budgetQb, 'b', scope, directorateId);
    const allBudgetEntries = await budgetQb.getMany();

    const snapshotQb = this.payrollSnapshotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.directorate', 'directorate')
      .leftJoinAndSelect('s.costCenter', 'costCenter')
      .where('s.year = :year', { year })
      .andWhere('s.month IN (:...months)', { months: referenceMonths });
    applyAccessScope(snapshotQb, 's', scope, directorateId);
    const snapshots = await snapshotQb.getMany();

    type Bucket = {
      directorateId: string;
      directorateName?: string;
      costCenterId: string;
      costCenterName?: string;
      budgetedCost: number;
      currentCost: number;
      budgetedCountByMonth: Map<number, number>;
      currentCountByMonth: Map<number, number>;
    };
    const buckets = new Map<string, Bucket>();
    const bucketKey = (directorateId: string, costCenterId: string) => `${directorateId}|${costCenterId}`;
    const getBucket = (directorateId: string, costCenterId: string, directorateName?: string, costCenterName?: string) => {
      const key = bucketKey(directorateId, costCenterId);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          directorateId,
          directorateName,
          costCenterId,
          costCenterName,
          budgetedCost: 0,
          currentCost: 0,
          budgetedCountByMonth: new Map(),
          currentCountByMonth: new Map(),
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const month of referenceMonths) {
      for (const entry of allBudgetEntries) {
        const value = monthValue(entry as any, month);
        if (value === null) continue;
        const bucket = getBucket(entry.directorateId, entry.costCenterId, entry.directorate?.name, entry.costCenter?.name);
        bucket.budgetedCost += Number(value);
        bucket.budgetedCountByMonth.set(month, (bucket.budgetedCountByMonth.get(month) ?? 0) + 1);
      }
      for (const snapshot of snapshots.filter((s) => s.month === month)) {
        if (!snapshot.costCenterId) continue;
        const bucket = getBucket(
          snapshot.directorateId,
          snapshot.costCenterId,
          snapshot.directorate?.name,
          snapshot.costCenter?.name,
        );
        bucket.currentCost += Number(snapshot.salary);
        bucket.currentCountByMonth.set(month, (bucket.currentCountByMonth.get(month) ?? 0) + 1);
      }
    }

    const monthCount = referenceMonths.length;
    const avgFromMonthMap = (map: Map<number, number>) =>
      Math.round(referenceMonths.reduce((sum, m) => sum + (map.get(m) ?? 0), 0) / monthCount);

    const items = Array.from(buckets.values())
      .map((bucket) => ({
        directorateId: bucket.directorateId,
        directorateName: bucket.directorateName,
        costCenterId: bucket.costCenterId,
        costCenterName: bucket.costCenterName,
        budgetedCost: bucket.budgetedCost,
        currentCost: bucket.currentCost,
        difference: bucket.currentCost - bucket.budgetedCost,
        budgetedCount: avgFromMonthMap(bucket.budgetedCountByMonth),
        currentCount: avgFromMonthMap(bucket.currentCountByMonth),
        status: bucket.currentCost > bucket.budgetedCost ? 'ACIMA' : 'DENTRO',
      }))
      .sort((a, b) => b.difference - a.difference);

    return {
      year,
      months: referenceMonths,
      items,
    };
  }

  async getMovements(year: number, scope: AccessScope, directorateId?: string, costCenterId?: string) {
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .where('EXTRACT(YEAR FROM m.effectiveDate) = :year', { year });
    applyAccessScope(qb, 'm', scope, directorateId, costCenterId);
    const movements = await qb.getMany();

    return {
      promotions: movements.filter((m) => m.type === MovementType.PROMOCAO).length,
      merits: movements.filter((m) => m.type === MovementType.MERITO).length,
      headcountIncrease: movements.filter((m) => m.type === MovementType.AUMENTO_QUADRO).length,
    };
  }

  async getFinancial(
    year: number,
    months: number[] | undefined,
    scope: AccessScope,
    directorateId?: string,
    costCenterId?: string,
  ) {
    const historyQb = this.historyRepo
      .createQueryBuilder('h')
      .where('EXTRACT(YEAR FROM h.effectiveDate) = :year', { year });
    applyAccessScope(historyQb, 'h', scope, directorateId, costCenterId);
    const historyRecords = await historyQb.getMany();

    const monthlyImpact = historyRecords.reduce((sum, h) => sum + Number(h.monthlyImpact || 0), 0);
    const annualImpact = historyRecords.reduce((sum, h) => sum + Number(h.annualImpact || 0), 0);

    const payroll = await this.getPayroll(year, months, scope, directorateId, costCenterId);
    const budgetConsumedPercent =
      payroll.payrollBudgeted > 0 ? (payroll.payrollCurrent / payroll.payrollBudgeted) * 100 : 0;

    const projection12Months = await this.getProjection12Months(scope, directorateId, costCenterId);
    const directorateRanking = await this.getDirectorateRanking(year, payroll.months);

    return {
      months: payroll.months,
      monthlyImpact,
      annualImpact,
      budgetConsumedPercent: Number(budgetConsumedPercent.toFixed(2)),
      projection12Months,
      directorateRanking,
      monthClosed: payroll.monthClosed,
      openMonths: payroll.openMonths,
    };
  }

  private async getProjection12Months(scope: AccessScope, directorateId?: string, costCenterId?: string) {
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
        statuses: [MovementStatus.APROVADO, MovementStatus.PENDENTE_APROVACAO],
      })
      .andWhere('m.effectiveDate BETWEEN :start AND :end', {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });
    applyAccessScope(qb, 'm', scope, directorateId, costCenterId);

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

  /**
   * Folha atual por diretoria usa exclusivamente o fechamento da folha
   * (payroll_snapshots) dos meses selecionados — nunca employees.current_
   * salary ao vivo, pelo mesmo motivo do resto do dashboard: o cadastro
   * reflete o salário mais recente de cada colaborador, não o da folha
   * fechada de um mês específico (ver resolveMonthlySalariesByMonth).
   * Soma os meses selecionados, igual à Folha Atual da seção de Folha de
   * Pagamento — não é mais anualizado (× 12).
   */
  private async getDirectorateRanking(year: number, months: number[]) {
    const directorates = await this.directorateRepo.find();

    const snapshots = await this.payrollSnapshotRepo.find({
      where: { year, month: In(months) },
    });

    const payrollByDirectorate = new Map<string, number>();
    for (const snapshot of snapshots) {
      payrollByDirectorate.set(
        snapshot.directorateId,
        (payrollByDirectorate.get(snapshot.directorateId) ?? 0) + Number(snapshot.salary || 0),
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
