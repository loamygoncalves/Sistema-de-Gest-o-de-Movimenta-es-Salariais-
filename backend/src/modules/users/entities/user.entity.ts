import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums';
import { Directorate } from '../../org/entities/directorate.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 200, unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @ManyToOne(() => Directorate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'directorate_id' })
  directorate?: Directorate;

  @Column({ name: 'directorate_id', nullable: true })
  directorateId?: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
