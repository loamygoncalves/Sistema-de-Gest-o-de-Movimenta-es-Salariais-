import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Ajuste de orçamento (tela "Ajuste de Orçamento", só ADMIN): um percentual
 * por ano que reduz/aumenta proporcionalmente todo "orçado" em R$ derivado
 * de `budget_entries` (Dashboard, Simulador, comparativo de colaboradores)
 * sem tocar os valores originais importados. Pode ser escopado —
 * `directorateId`/`costCenterId` nulos = "todos" (aplica à empresa
 * inteira); só `directorateId` = uma diretoria inteira; ambos = um centro
 * de resultado específico. Pode coexistir mais de uma linha por ano (uma
 * "todos" + uma ou mais scoped) — a mais específica que casar com a linha
 * de orçamento vence (ver BudgetService#resolveAdjustmentFactor). Sem
 * nenhuma linha aplicável para o ano/escopo, o fator é 100% (nenhum
 * ajuste). Nunca afeta contagem de HC orçado (vagas), só os valores
 * monetários.
 */
@Entity('budget_adjustments')
export class BudgetAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'directorate_id', type: 'uuid', nullable: true })
  directorateId: string | null;

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string | null;

  @Column('numeric', { precision: 5, scale: 2 })
  percent: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
