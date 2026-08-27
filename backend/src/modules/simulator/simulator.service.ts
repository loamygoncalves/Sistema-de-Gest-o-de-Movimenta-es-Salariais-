import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeValueType, MovementType } from '../../common/enums';
import { budgetAdjustmentFactor, sumAllMonths } from '../../common/utils/months.util';
import { PayrollSnapshot } from '../employees/entities/payroll-snapshot.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { BudgetAdjustment } from '../budget/entities/budget-adjustment.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { ChargeParametersService } from './charge-parameters.service';

export interface SimulationResult {
  monthsRemaining: number;
  monthlySalaryImpact: number;
  annualSalaryImpact: number;
  chargesTotal: number;
  benefitsTotal: number;
  totalMonthlyImpact: number;
  totalAnnualImpact: number;
  budgetedDirectoratePayroll: number;
  currentDirectoratePayroll: number;
  payrollAfterApproval: number;
  difference: number;
  percentConsumed: number;
  exceedsBudget: boolean;
  alertMessage: string;
  salaryIncreasePercent: number | null;
}

/** Entrada mínima para simular sem depender de um MovementRequest persistido (ver simulador rápido). */
export interface SimulationInput {
  type: MovementType;
  directorateId: string;
  costCenterId?: string | null;
  currentSalary?: number | null;
  newSalary?: number | null;
  meritPercentage?: number | null;
  plannedSalary?: number | null;
  quantity?: number | null;
  effectiveDate: string;
}

@Injectable()
export class SimulatorService {
  constructor(
    private readonly chargeParametersService: ChargeParametersService,
    private readonly configService: ConfigService,
    @InjectRepository(PayrollSnapshot)
    private readonly payrollSnapshotRepo: Repository<PayrollSnapshot>,
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
    @InjectRepository(BudgetAdjustment)
    private readonly budgetAdjustmentRepo: Repository<BudgetAdjustment>,
  ) {}

  /**
   * Extrai {year, month} de uma data `YYYY-MM-DD` direto da string, sem
   * passar por `new Date(...).getMonth()/getFullYear()`: uma string
   * date-only é interpretada como meia-noite UTC pelo `Date`, então em
   * qualquer servidor com timezone atrás de UTC (ex.: America/Sao_Paulo,
   * UTC-3) os getters locais devolveriam o dia/mês anterior — 01/09
   * "viraria" 31/08 e a movimentação seria contada a partir de agosto em
   * vez de setembro.
   */
  private parseIsoDateParts(isoDate: string): { year: number; month: number } {
    const [year, month] = isoDate.split('-').map(Number);
    return { year, month };
  }

  /** Meses restantes no ano-calendário da data efetiva, incluindo o próprio mês (Jan=12, Dez=1). */
  private monthsRemaining(effectiveDate: string): number {
    const { month } = this.parseIsoDateParts(effectiveDate);
    return 13 - month;
  }

  /** Diferença de salário mensal introduzida pela movimentação. */
  private monthlySalaryImpact(input: SimulationInput): number {
    switch (input.type) {
      case MovementType.PROMOCAO:
        return Number(input.newSalary ?? 0) - Number(input.currentSalary ?? 0);
      case MovementType.MERITO: {
        const current = Number(input.currentSalary ?? 0);
        const percent = Number(input.meritPercentage ?? 0);
        return current * (percent / 100);
      }
      case MovementType.AUMENTO_QUADRO:
        return Number(input.plannedSalary ?? 0) * Number(input.quantity ?? 1);
      default:
        return 0;
    }
  }

  /**
   * Orçamento anual do centro de custo (diretoria + centro de custo) em que
   * a movimentação recai — nunca por cargo: o orçamento é sempre olhado no
   * nível do centro de custo (e da diretoria), a mesma unidade usada em toda
   * comparação orçamento x realizado do sistema (BudgetService.getDashboard,
   * EmployeesService.compareWithBudget). Sem centro de custo não há como
   * localizar uma linha orçamentária e o orçamento é considerado zero.
   */
  private async bucketBudgetAnnual(
    directorateId: string,
    costCenterId: string | null | undefined,
    year: number,
  ): Promise<number> {
    if (!costCenterId) return 0;
    const entries = await this.budgetRepo.find({
      where: { directorateId, costCenterId } as any,
    });
    const factor = await this.getAdjustmentFactor(year);
    return entries.reduce((sum, entry) => sum + sumAllMonths(entry as any), 0) * factor;
  }

  /** Fator do Ajuste de Orçamento (tela ADMIN) do ano — nunca gravado sobre budget_entries, só aplicado na leitura. */
  private async getAdjustmentFactor(year: number): Promise<number> {
    const row = await this.budgetAdjustmentRepo.findOne({ where: { year } });
    return budgetAdjustmentFactor(row?.percent);
  }

  /**
   * Folha real acumulada (soma, não anualizada) desse centro de custo em
   * todos os meses já fechados do ano de referência (`year`, o ano da data
   * efetiva da movimentação) — usa exclusivamente payroll_snapshots, nunca
   * employees.current_salary ao vivo. Também devolve o total do ÚLTIMO mês
   * fechado nesse centro de custo, base para projetar os meses restantes
   * (ver simulate() abaixo). Sem nenhum fechamento no ano, tudo vem zerado
   * em vez de herdar o cadastro ou outro ano.
   */
  private async bucketClosedMonthsPayroll(
    directorateId: string,
    costCenterId: string | null | undefined,
    year: number,
  ): Promise<{ yearToDatePayroll: number; lastMonthPayroll: number; lastClosedMonth: number | null }> {
    if (!costCenterId) return { yearToDatePayroll: 0, lastMonthPayroll: 0, lastClosedMonth: null };
    const snapshots = await this.payrollSnapshotRepo.find({
      where: { year, directorateId, costCenterId } as any,
    });
    if (snapshots.length === 0) return { yearToDatePayroll: 0, lastMonthPayroll: 0, lastClosedMonth: null };

    const yearToDatePayroll = snapshots.reduce((sum, s) => sum + Number(s.salary || 0), 0);
    const lastClosedMonth = Math.max(...snapshots.map((s) => s.month));
    const lastMonthPayroll = snapshots
      .filter((s) => s.month === lastClosedMonth)
      .reduce((sum, s) => sum + Number(s.salary || 0), 0);

    return { yearToDatePayroll, lastMonthPayroll, lastClosedMonth };
  }

  async simulate(input: SimulationInput): Promise<SimulationResult> {
    const monthsRemaining = this.monthsRemaining(input.effectiveDate);
    const monthlySalaryImpact = this.monthlySalaryImpact(input);
    const annualSalaryImpact = monthlySalaryImpact * monthsRemaining;

    const chargeParameters = await this.chargeParametersService.findAllActive();
    let chargesTotal = 0;
    let benefitsTotal = 0;
    for (const param of chargeParameters) {
      const amount =
        param.valueType === ChargeValueType.PERCENTUAL
          ? monthlySalaryImpact * (Number(param.value) / 100)
          : Number(param.value);
      if (param.isBenefit) benefitsTotal += amount;
      else chargesTotal += amount;
    }

    const totalMonthlyImpact = monthlySalaryImpact + chargesTotal + benefitsTotal;
    const totalAnnualImpact = totalMonthlyImpact * monthsRemaining;

    const effectiveYear = this.parseIsoDateParts(input.effectiveDate).year;
    const budgetedDirectoratePayroll = await this.bucketBudgetAnnual(
      input.directorateId,
      input.costCenterId,
      effectiveYear,
    );
    const { yearToDatePayroll, lastMonthPayroll, lastClosedMonth } = await this.bucketClosedMonthsPayroll(
      input.directorateId,
      input.costCenterId,
      effectiveYear,
    );
    const currentDirectoratePayroll = yearToDatePayroll;

    // Meses entre o último fechamento e a movimentação (ex.: fechamento até
    // agosto, movimentação efetiva em novembro) não têm folha real nem
    // impacto da movimentação ainda — para não ficarem de fora da projeção
    // anual, replicam o último fechamento sem o impacto (setembro/outubro
    // no exemplo); a partir do mês da movimentação, a projeção normal
    // (último fechamento + impacto, meses restantes) assume.
    const effectiveMonth = this.parseIsoDateParts(input.effectiveDate).month;
    const gapMonths = lastClosedMonth ? Math.max(0, effectiveMonth - lastClosedMonth - 1) : 0;
    const gapPayroll = lastMonthPayroll * gapMonths;

    // Projeção até dezembro: acumulado real (meses já fechados) + meses de
    // lacuna replicados sem impacto + meses que faltam no ano, projetados a
    // partir do último fechamento já com o impacto mensal total da
    // movimentação — não um simples "atual anual + impacto x meses", que
    // ignoraria o histórico real do centro de custo.
    const projectedMonthlyPayroll = lastMonthPayroll + totalMonthlyImpact;
    const projectedRemainingPayroll = projectedMonthlyPayroll * monthsRemaining;
    const payrollAfterApproval = yearToDatePayroll + gapPayroll + projectedRemainingPayroll;
    const difference = budgetedDirectoratePayroll - payrollAfterApproval;
    const percentConsumed =
      budgetedDirectoratePayroll > 0
        ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100
        : 0;
    const exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    let alertMessage: string;
    if (!input.costCenterId) {
      alertMessage = 'Não foi possível localizar o centro de custo para comparar com o orçamento.';
    } else if (exceedsBudget) {
      const excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = `Movimentação excede o orçamento do centro de custo em ${excessPercent.toFixed(1)}%.`;
    } else {
      alertMessage = 'Movimentação aderente ao orçamento.';
    }

    const baseSalary = Number(input.currentSalary ?? 0);
    const salaryIncreasePercent = baseSalary > 0 ? (monthlySalaryImpact / baseSalary) * 100 : null;
    const maxIncreasePercentAlert = this.configService.get<number>('rules.maxIncreasePercentAlert')!;
    if (salaryIncreasePercent !== null && salaryIncreasePercent > maxIncreasePercentAlert) {
      alertMessage += ` Atenção: aumento de ${salaryIncreasePercent.toFixed(
        1,
      )}% ultrapassa o limite de ${maxIncreasePercentAlert}% configurado.`;
    }

    return {
      monthsRemaining,
      monthlySalaryImpact,
      annualSalaryImpact,
      chargesTotal,
      benefitsTotal,
      totalMonthlyImpact,
      totalAnnualImpact,
      budgetedDirectoratePayroll,
      currentDirectoratePayroll,
      payrollAfterApproval,
      difference,
      percentConsumed: Number(percentConsumed.toFixed(3)),
      exceedsBudget,
      alertMessage,
      salaryIncreasePercent,
    };
  }

  /** Adapta um MovementRequest persistido para o formato de entrada do simulador. */
  simulateMovement(movement: MovementRequest): Promise<SimulationResult> {
    return this.simulate({
      type: movement.type,
      directorateId: movement.directorateId,
      costCenterId: movement.costCenterId,
      currentSalary: movement.currentSalary,
      newSalary: movement.newSalary,
      meritPercentage: movement.meritPercentage,
      plannedSalary: movement.plannedSalary,
      quantity: movement.quantity,
      effectiveDate: movement.effectiveDate,
    });
  }
}
