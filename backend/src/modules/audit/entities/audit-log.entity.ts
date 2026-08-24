import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 100 })
  entity: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, any>;

  @Column({ length: 64, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
