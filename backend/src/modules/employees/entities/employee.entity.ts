import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContractType, EmployeeStatus } from '../../../common/enums';
import { Directorate } from '../../org/entities/directorate.entity';
import { Management } from '../../org/entities/management.entity';
import { Coordination } from '../../org/entities/coordination.entity';
import { Position } from '../../org/entities/position.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  registration: string;

  @Column({ length: 200 })
  name: string;

  @ManyToOne(() => Position, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'position_id' })
  positionId: string;

  @ManyToOne(() => Directorate, { onDelete: 'RESTRICT', eager: true })
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

  @Column({ type: 'date', name: 'admission_date' })
  admissionDate: string;

  @Column('numeric', { precision: 14, scale: 2, name: 'current_salary' })
  currentSalary: number;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ATIVO })
  status: EmployeeStatus;

  @Column({ name: 'last_import_batch_id', nullable: true })
  lastImportBatchId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
