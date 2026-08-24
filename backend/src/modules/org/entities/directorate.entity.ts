import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('directorates')
export class Directorate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150, unique: true })
  name: string;

  @Column('numeric', { precision: 16, scale: 2, default: 0, name: 'annual_budget' })
  annualBudget: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
