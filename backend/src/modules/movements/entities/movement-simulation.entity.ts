import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MovementRequest } from './movement-request.entity';

@Entity('movement_simulations')
export class MovementSimulation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MovementRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movement_request_id' })
  movementRequest: MovementRequest;

  @Column({ name: 'movement_request_id' })
  movementRequestId: string;

  @Column({ name: 'months_remaining' })
  monthsRemaining: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'monthly_salary_impact' })
  monthlySalaryImpact: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'annual_salary_impact' })
  annualSalaryImpact: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'charges_total' })
  chargesTotal: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'benefits_total' })
  benefitsTotal: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'total_monthly_impact' })
  totalMonthlyImpact: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'total_annual_impact' })
  totalAnnualImpact: number;

  @Column('numeric', {
    precision: 16,
    scale: 2,
    name: 'budgeted_directorate_payroll',
  })
  budgetedDirectoratePayroll: number;

  @Column('numeric', {
    precision: 16,
    scale: 2,
    name: 'current_directorate_payroll',
  })
  currentDirectoratePayroll: number;

  @Column('numeric', { precision: 16, scale: 2, name: 'payroll_after_approval' })
  payrollAfterApproval: number;

  @Column('numeric', { precision: 16, scale: 2 })
  difference: number;

  @Column('numeric', { precision: 7, scale: 3, name: 'percent_consumed' })
  percentConsumed: number;

  @Column({ default: false, name: 'exceeds_budget' })
  exceedsBudget: boolean;

  @Column({ length: 500, nullable: true, name: 'alert_message' })
  alertMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
