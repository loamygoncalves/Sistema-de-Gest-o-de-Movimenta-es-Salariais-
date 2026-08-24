import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ImportBatch } from '../../imports/entities/import-batch.entity';
import { SalaryStudyEntry } from './salary-study-entry.entity';

@Entity('salary_studies')
export class SalaryStudy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 200, nullable: true })
  source?: string;

  @Column({ name: 'reference_year' })
  referenceYear: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'imported_by' })
  importedBy: User;

  @Column({ name: 'imported_by' })
  importedById: string;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: ImportBatch;

  @Column({ name: 'import_batch_id', nullable: true })
  importBatchId?: string;

  @OneToMany(() => SalaryStudyEntry, (entry) => entry.study)
  entries: SalaryStudyEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
