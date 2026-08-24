import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlannedSituation } from '../../../common/enums';
import { Directorate } from '../../org/entities/directorate.entity';
import { Position } from '../../org/entities/position.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';
import { ImportBatch } from '../../imports/entities/import-batch.entity';

/**
 * Linha de orçamento anual: (ano, diretoria, centro de custo, cargo, tipo de
 * movimentação) + custo orçado mês a mês (jan..dez). Não é vinculada a um
 * colaborador — o orçamento é por diretoria/centro de custo/cargo, não por
 * matrícula. Uma mesma combinação diretoria+centro de custo+cargo pode ter
 * várias linhas ao longo do ano (ex.: uma linha "Sem Movimentação" cobrindo
 * jan-fev e outra "Promoção" cobrindo mar-dez, representando a mesma vaga
 * mudando de situação no meio do ano); cada coluna mensal null/vazia
 * significa que a linha não tem custo orçado naquele mês.
 */
@Entity('budget_entries')
export class BudgetEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  year: number;

  @ManyToOne(() => Directorate, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @ManyToOne(() => CostCenter, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter: CostCenter;

  @Column({ name: 'cost_center_id' })
  costCenterId: string;

  @ManyToOne(() => Position, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'position_id' })
  positionId: string;

  @Column({
    type: 'enum',
    enum: PlannedSituation,
    default: PlannedSituation.SEM_MOVIMENTACAO,
    name: 'movement_type',
  })
  movementType: PlannedSituation;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  jan?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  fev?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  mar?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  abr?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  mai?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  jun?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  jul?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  ago?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  set?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  out?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  nov?: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true })
  dez?: number | null;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: ImportBatch;

  @Column({ name: 'import_batch_id', nullable: true })
  importBatchId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
