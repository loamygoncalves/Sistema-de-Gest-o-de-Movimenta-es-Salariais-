import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Management } from './management.entity';

@Entity('coordinations')
export class Coordination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Management, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'management_id' })
  management: Management;

  @Column({ name: 'management_id' })
  managementId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
