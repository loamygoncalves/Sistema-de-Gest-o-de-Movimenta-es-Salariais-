import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SalaryStudy } from './salary-study.entity';
import { Position } from '../../org/entities/position.entity';

@Entity('salary_study_entries')
export class SalaryStudyEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SalaryStudy, (study) => study.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_id' })
  study: SalaryStudy;

  @Column({ name: 'study_id' })
  studyId: string;

  @ManyToOne(() => Position, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'position_id' })
  positionId: string;

  @Column({ length: 200, nullable: true, name: 'company_name' })
  companyName?: string;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'min_salary' })
  minSalary?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'avg_salary' })
  avgSalary?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, name: 'max_salary' })
  maxSalary?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  p25?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  p50?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  p75?: number;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  p90?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
