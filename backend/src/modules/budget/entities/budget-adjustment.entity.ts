import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Ajuste global de orçamento (tela "Ajuste de Orçamento", só ADMIN): um
 * percentual por ano que reduz/aumenta proporcionalmente todo "orçado" em
 * R$ derivado de `budget_entries` (Dashboard, Simulador, comparativo de
 * colaboradores) sem tocar os valores originais importados — sem linha
 * para o ano, o fator é 100% (nenhum ajuste). Não afeta contagem de HC
 * orçado (vagas), só os valores monetários.
 */
@Entity('budget_adjustments')
export class BudgetAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  year: number;

  @Column('numeric', { precision: 5, scale: 2 })
  percent: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
