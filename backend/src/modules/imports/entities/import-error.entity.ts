import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportBatch } from './import-batch.entity';

@Entity('import_errors')
export class ImportError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ImportBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: ImportBatch;

  @Column({ name: 'batch_id' })
  batchId: string;

  @Column({ name: 'row_number' })
  rowNumber: number;

  @Column({ length: 100, nullable: true })
  field?: string;

  @Column({ length: 500 })
  message: string;
}
