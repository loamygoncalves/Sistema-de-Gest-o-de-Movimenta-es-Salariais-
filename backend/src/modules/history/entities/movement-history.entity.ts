import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MovementType } from '../../../common/enums';
import { MovementRequest } from '../../movements/entities/movement-request.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Directorate } from '../../org/entities/directorate.entity';
import { Position } from '../../org/entities/position.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';

@Entity('movement_history')
export class MovementHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MovementRequest)
  @JoinColumn({ name: 'movement_request_id' })
  movementRequest: MovementRequest;

  @Column({ name: 'movement_request_id' })
  movementRequestId: string;

  @ManyToOne(() => Employee, { nullable: true, eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'employee_id', nullable: true })
  employeeId?: string;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @ManyToOne(() => Directorate, { eager: true })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @ManyToOne(() => Position, { nullable: true, eager: true })
  @JoinColumn({ name: 'position_id' })
  position?: Position;

  @Column({ name: 'position_id', nullable: true })
  positionId?: string;

  @ManyToOne(() => CostCenter, { nullable: true })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter;

  @Column({ name: 'cost_center_id', nullable: true })
  costCenterId?: string;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'previous_salary' })
  previousSalary?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'new_salary' })
  newSalary?: number;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: string;

  @Column({ name: 'approved_at' })
  approvedAt: Date;

  @Column('numeric', { precision: 14, scale: 2, name: 'monthly_impact' })
  monthlyImpact: number;

  @Column('numeric', { precision: 14, scale: 2, name: 'annual_impact' })
  annualImpact: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
