import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Directorate } from './directorate.entity';

@Entity('managements')
export class Management {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Directorate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
