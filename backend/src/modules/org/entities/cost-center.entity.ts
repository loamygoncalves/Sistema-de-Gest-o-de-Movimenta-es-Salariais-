import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Directorate } from './directorate.entity';

@Entity('cost_centers')
export class CostCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ length: 150 })
  name: string;

  @ManyToOne(() => Directorate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'directorate_id' })
  directorate?: Directorate;

  @Column({ name: 'directorate_id', nullable: true })
  directorateId?: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
