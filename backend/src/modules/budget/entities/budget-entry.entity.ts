import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContractType, PlannedSituation } from '../../../common/enums';
import { Directorate } from '../../org/entities/directorate.entity';
import { Management } from '../../org/entities/management.entity';
import { Coordination } from '../../org/entities/coordination.entity';
import { Position } from '../../org/entities/position.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { ImportBatch } from '../../imports/entities/import-batch.entity';

@Entity('budget_entries')
export class BudgetEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  year: number;

  @Column({ length: 30, nullable: true })
  registration?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'employee_id', nullable: true })
  employeeId?: string;

  @Column({ length: 200, nullable: true })
  name?: string;

  @ManyToOne(() => Position, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'position_id' })
  positionId: string;

  @ManyToOne(() => Directorate, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @ManyToOne(() => Management, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'management_id' })
  management?: Management;

  @Column({ name: 'management_id', nullable: true })
  managementId?: string;

  @ManyToOne(() => Coordination, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coordination_id' })
  coordination?: Coordination;

  @Column({ name: 'coordination_id', nullable: true })
  coordinationId?: string;

  @ManyToOne(() => CostCenter, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter;

  @Column({ name: 'cost_center_id', nullable: true })
  costCenterId?: string;

  @Column({ length: 120, nullable: true })
  city?: string;

  @Column({ length: 2, nullable: true })
  state?: string;

  @Column({
    type: 'enum',
    enum: ContractType,
    default: ContractType.CLT,
    name: 'contract_type',
  })
  contractType: ContractType;

  @Column({ type: 'date', name: 'admission_date', nullable: true })
  admissionDate?: string;

  @Column('numeric', { precision: 14, scale: 2, default: 0, name: 'current_salary' })
  currentSalary: number;

  @Column({
    type: 'enum',
    enum: PlannedSituation,
    default: PlannedSituation.SEM_MOVIMENTACAO,
    name: 'planned_situation',
  })
  plannedSituation: PlannedSituation;

  @Column('numeric', { precision: 14, scale: 2, default: 0, name: 'planned_salary' })
  plannedSalary: number;

  @Column({ type: 'smallint', nullable: true, name: 'planned_month' })
  plannedMonth?: number;

  @Column('numeric', {
    precision: 14,
    scale: 2,
    default: 0,
    name: 'monthly_budgeted_cost',
  })
  monthlyBudgetedCost: number;

  @Column('numeric', {
    precision: 14,
    scale: 2,
    default: 0,
    name: 'annual_budgeted_cost',
  })
  annualBudgetedCost: number;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: ImportBatch;

  @Column({ name: 'import_batch_id', nullable: true })
  importBatchId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
