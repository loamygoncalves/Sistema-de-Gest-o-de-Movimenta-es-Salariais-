import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalStatus } from '../../../common/enums';
import { MovementRequest } from '../../movements/entities/movement-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('approval_steps')
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MovementRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movement_request_id' })
  movementRequest: MovementRequest;

  @Column({ name: 'movement_request_id' })
  movementRequestId: string;

  @Column({ type: 'smallint', name: 'step_order' })
  stepOrder: number;

  /** Snapshot dos perfis elegíveis para decidir esta etapa (qualquer um deles), tirado de ApprovalWorkflowStep no momento da submissão. */
  @Column({ type: 'text', array: true, name: 'eligible_roles' })
  eligibleRoles: string[];

  /** Perfil que o aprovador tinha ao decidir (auditoria) — nulo enquanto PENDENTE. */
  @Column({ type: 'text', name: 'decided_by_role', nullable: true })
  decidedByRole?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_user_id' })
  approverUser?: User;

  @Column({ name: 'approver_user_id', nullable: true })
  approverUserId?: string;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDENTE })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ name: 'decided_at', nullable: true })
  decidedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
