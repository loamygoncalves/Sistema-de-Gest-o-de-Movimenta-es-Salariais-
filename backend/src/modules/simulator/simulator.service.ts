import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeValueType, EmployeeStatus, MovementType } from '../../common/enums';
import { sumAllMonths } from '../../common/utils/months.util';
import { Employee } from '../employees/entities/employee.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
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
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(BudgetEntry)
    private readonly budgetRepo: Repository<BudgetEntry>,
  ) {}

  /** Meses restantes no ano-calendário da data efetiva, incluindo o próprio mês (Jan=12, Dez=1). */
  private monthsRemaining(effectiveDate: string): number {
    const date = new Date(effectiveDate);
    return 13 - (date.getMonth() + 1);
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
  ): Promise<number> {
    if (!costCenterId) return 0;
    const entries = await this.budgetRepo.find({
      where: { directorateId, costCenterId } as any,
    });
    return entries.reduce((sum, entry) => sum + sumAllMonths(entry as any), 0);
  }

  /** Folha anualizada (salário mensal x12) dos colaboradores ativos hoje nesse mesmo centro de custo. */
  private async bucketCurrentAnnualPayroll(
    directorateId: string,
    costCenterId: string | null | undefined,
  ): Promise<number> {
    if (!costCenterId) return 0;
    const employees = await this.employeeRepo.find({
      where: { directorateId, costCenterId, status: EmployeeStatus.ATIVO } as any,
    });
    return employees.reduce((sum, e) => sum + Number(e.currentSalary || 0), 0) * 12;
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

    const budgetedDirectoratePayroll = await this.bucketBudgetAnnual(
      input.directorateId,
      input.costCenterId,
    );
    const currentDirectoratePayroll = await this.bucketCurrentAnnualPayroll(
      input.directorateId,
      input.costCenterId,
    );

    const payrollAfterApproval = currentDirectoratePayroll + totalAnnualImpact;
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
