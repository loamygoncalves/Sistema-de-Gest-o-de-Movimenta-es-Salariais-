import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovementStatus, MovementType } from '../../../common/enums';
import { Employee } from '../../employees/entities/employee.entity';
import { Directorate } from '../../org/entities/directorate.entity';
import { Position } from '../../org/entities/position.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';
import { User } from '../../users/entities/user.entity';

@Entity('movement_requests')
export class MovementRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @Column({ type: 'enum', enum: MovementStatus, default: MovementStatus.RASCUNHO })
  status: MovementStatus;

  @ManyToOne(() => Employee, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'employee_id', nullable: true })
  employeeId?: string;

  @ManyToOne(() => Directorate, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @ManyToOne(() => CostCenter, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter;

  @Column({ name: 'cost_center_id', nullable: true })
  costCenterId?: string;

  @ManyToOne(() => Position, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_position_id' })
  currentPosition?: Position;

  @Column({ name: 'current_position_id', nullable: true })
  currentPositionId?: string;

  @ManyToOne(() => Position, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'new_position_id' })
  newPosition?: Position;

  @Column({ name: 'new_position_id', nullable: true })
  newPositionId?: string;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'current_salary' })
  currentSalary?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'new_salary' })
  newSalary?: number;

  @Column('numeric', { precision: 6, scale: 3, nullable: true, name: 'merit_percentage' })
  meritPercentage?: number;

  @Column({ type: 'int', nullable: true })
  quantity?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'planned_salary' })
  plannedSalary?: number;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: string;

  @Column({ type: 'text' })
  justification: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @Column({ name: 'requested_by' })
  requestedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
