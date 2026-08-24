import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeValueType, MovementType } from '../../common/enums';
import { Directorate } from '../org/entities/directorate.entity';
import { Employee } from '../employees/entities/employee.entity';
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

@Injectable()
export class SimulatorService {
  constructor(
    private readonly chargeParametersService: ChargeParametersService,
    private readonly configService: ConfigService,
    @InjectRepository(Directorate)
    private readonly directorateRepo: Repository<Directorate>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  /** Meses restantes no ano-calendário da data efetiva, incluindo o próprio mês (Jan=12, Dez=1). */
  private monthsRemaining(effectiveDate: string): number {
    const date = new Date(effectiveDate);
    return 13 - (date.getMonth() + 1);
  }

  /** Diferença de salário mensal introduzida pela movimentação. */
  private monthlySalaryImpact(movement: MovementRequest): number {
    switch (movement.type) {
      case MovementType.PROMOCAO:
      case MovementType.TRANSFERENCIA:
        return Number(movement.newSalary ?? 0) - Number(movement.currentSalary ?? 0);
      case MovementType.MERITO: {
        const current = Number(movement.currentSalary ?? 0);
        const percent = Number(movement.meritPercentage ?? 0);
        return current * (percent / 100);
      }
      case MovementType.AUMENTO_QUADRO:
        return Number(movement.plannedSalary ?? 0) * Number(movement.quantity ?? 1);
      default:
        return 0;
    }
  }

  async simulate(movement: MovementRequest): Promise<SimulationResult> {
    const monthsRemaining = this.monthsRemaining(movement.effectiveDate);
    const monthlySalaryImpact = this.monthlySalaryImpact(movement);
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

    const directorate = await this.directorateRepo.findOneOrFail({
      where: { id: movement.directorateId },
    });
    const budgetedDirectoratePayroll = Number(directorate.annualBudget);

    const activeEmployees = await this.employeeRepo.find({
      where: { directorateId: movement.directorateId } as any,
    });
    const currentDirectoratePayroll =
      activeEmployees.reduce((sum, e) => sum + Number(e.currentSalary || 0), 0) * 12;

    const payrollAfterApproval = currentDirectoratePayroll + totalAnnualImpact;
    const difference = budgetedDirectoratePayroll - payrollAfterApproval;
    const percentConsumed =
      budgetedDirectoratePayroll > 0
        ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100
        : 0;
    const exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    let alertMessage: string;
    if (exceedsBudget) {
      const excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = `Movimentação excede orçamento da diretoria em ${excessPercent.toFixed(1)}%.`;
    } else {
      alertMessage = 'Movimentação aderente ao orçamento.';
    }

    const baseSalary = Number(movement.currentSalary ?? 0);
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
}
