import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150, unique: true })
  name: string;

  @Column({ length: 50, nullable: true, name: 'career_level' })
  careerLevel?: string;

  /** Oculta o salário dos colaboradores desse cargo para o perfil GESTOR (ex.: Gerente/Diretor). */
  @Column({ default: false, name: 'hide_salary_from_manager' })
  hideSalaryFromManager: boolean;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
