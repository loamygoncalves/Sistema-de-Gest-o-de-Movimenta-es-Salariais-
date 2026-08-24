import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportStatus, ImportType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ImportType })
  type: ImportType;

  @Column({ length: 255 })
  filename: string;

  @Column({ name: 'reference_year', nullable: true })
  referenceYear?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'imported_by' })
  importedBy: User;

  @Column({ name: 'imported_by' })
  importedById: string;

  @Column({ type: 'enum', enum: ImportStatus, default: ImportStatus.PROCESSANDO })
  status: ImportStatus;

  @Column({ name: 'total_rows', default: 0 })
  totalRows: number;

  @Column({ name: 'success_rows', default: 0 })
  successRows: number;

  @Column({ name: 'error_rows', default: 0 })
  errorRows: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'finished_at', nullable: true })
  finishedAt?: Date;
}
