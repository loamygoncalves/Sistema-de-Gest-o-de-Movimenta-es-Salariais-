import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajuste global de orçamento (tela "Ajuste de Orçamento", só ADMIN): um
 * percentual por ano (ex.: 90%) que reduz/aumenta proporcionalmente todo
 * "orçado" em R$ exibido (Dashboard, Simulador, comparativo de
 * colaboradores) sem alterar os valores originais importados em
 * `budget_entries` — o ajuste é aplicado em memória na leitura, nunca
 * gravado sobre a fonte, para não compor erros ao trocar o percentual
 * repetidamente. Sem linha para um ano, esse ano fica em 100% (sem ajuste).
 */
export class BudgetAdjustment1700000007000 implements MigrationInterface {
  name = 'BudgetAdjustment1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE budget_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year INT NOT NULL UNIQUE,
        percent NUMERIC(5,2) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_budget_adjustment_percent CHECK (percent > 0 AND percent <= 300)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE budget_adjustments;`);
  }
}
