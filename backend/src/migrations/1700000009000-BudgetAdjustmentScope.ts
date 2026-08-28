import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajuste de Orçamento passa a poder ser escopado — "todos" (comportamento
 * original, directorate_id/cost_center_id NULL), uma diretoria inteira
 * (directorate_id preenchido, cost_center_id NULL) ou um centro de
 * resultado específico (ambos preenchidos). A unicidade por (year) vira
 * unicidade por (year, directorate_id, cost_center_id) — aplicada em
 * BudgetService (nunca em constraint de banco, já que Postgres trata NULL
 * como distinto de NULL e uma UNIQUE ingênua deixaria repetir "todos" no
 * mesmo ano). Ver BudgetService#resolveAdjustmentFactor.
 */
export class BudgetAdjustmentScope1700000009000 implements MigrationInterface {
  name = 'BudgetAdjustmentScope1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE budget_adjustments
        DROP CONSTRAINT IF EXISTS budget_adjustments_year_key,
        ADD COLUMN directorate_id UUID REFERENCES directorates(id) ON DELETE CASCADE,
        ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE;

      CREATE INDEX idx_budget_adjustments_year ON budget_adjustments(year);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_budget_adjustments_year;
      ALTER TABLE budget_adjustments
        DROP COLUMN IF EXISTS cost_center_id,
        DROP COLUMN IF EXISTS directorate_id,
        ADD CONSTRAINT budget_adjustments_year_key UNIQUE (year);
    `);
  }
}
