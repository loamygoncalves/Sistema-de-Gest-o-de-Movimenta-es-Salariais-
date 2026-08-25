import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums';
import { Directorate } from '../../org/entities/directorate.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';

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

  /**
   * Escopo de Gestor: centros de custo que ele pode ver/gerenciar (em vez
   * de uma diretoria inteira, como o Diretor). Não usado para outros perfis.
   */
  @ManyToMany(() => CostCenter)
  @JoinTable({
    name: 'user_cost_centers',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'cost_center_id' },
  })
  costCenters?: CostCenter[];

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
