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

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
