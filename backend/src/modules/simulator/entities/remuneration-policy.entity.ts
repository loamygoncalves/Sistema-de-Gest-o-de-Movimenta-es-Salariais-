import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Política de Remuneração (tela ADMIN/RH_REMUNERACAO): limites globais
 * opcionais para % de reajuste de Mérito, % de reajuste de Promoção, e
 * intervalo mínimo em meses entre reajustes de um mesmo colaborador — uma
 * única linha (singleton, sem chave de negócio). Nenhum campo é
 * obrigatório: null = sem limite configurado para aquele campo. Violar a
 * política nunca bloqueia a simulação/submissão — só sinaliza (ver
 * `SimulatorService#checkPolicyViolations`), tanto para quem simula quanto
 * para quem aprova.
 */
@Entity('remuneration_policies')
export class RemunerationPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('numeric', { precision: 6, scale: 3, nullable: true, name: 'max_merit_percent' })
  maxMeritPercent: number | null;

  @Column('numeric', { precision: 6, scale: 3, nullable: true, name: 'max_promotion_percent' })
  maxPromotionPercent: number | null;

  @Column({ type: 'int', nullable: true, name: 'min_months_between_raises' })
  minMonthsBetweenRaises: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
