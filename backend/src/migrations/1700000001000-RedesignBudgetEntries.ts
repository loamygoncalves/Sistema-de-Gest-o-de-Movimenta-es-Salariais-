import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Redesenha budget_entries: o orçamento deixa de ser vinculado a um
 * colaborador (matrícula) e passa a ser por (diretoria, centro de custo,
 * cargo, tipo de movimentação) com custo orçado mês a mês (jan..dez) — ver
 * BudgetEntry entity e docs/API_CONTRACT.md para o novo contrato.
 */
export class RedesignBudgetEntries1700000001000 implements MigrationInterface {
  name = 'RedesignBudgetEntries1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE budget_entries DROP CONSTRAINT IF EXISTS budget_entries_year_registration_key;
      ALTER TABLE budget_entries DROP CONSTRAINT IF EXISTS budget_entries_cost_center_id_fkey;

      ALTER TABLE budget_entries
        DROP COLUMN IF EXISTS registration,
        DROP COLUMN IF EXISTS employee_id,
        DROP COLUMN IF EXISTS name,
        DROP COLUMN IF EXISTS management_id,
        DROP COLUMN IF EXISTS coordination_id,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS contract_type,
        DROP COLUMN IF EXISTS admission_date,
        DROP COLUMN IF EXISTS current_salary,
        DROP COLUMN IF EXISTS planned_situation,
        DROP COLUMN IF EXISTS planned_salary,
        DROP COLUMN IF EXISTS planned_month,
        DROP COLUMN IF EXISTS monthly_budgeted_cost,
        DROP COLUMN IF EXISTS annual_budgeted_cost;

      DROP TYPE IF EXISTS planned_situation;
      CREATE TYPE planned_situation AS ENUM (
        'SEM_MOVIMENTACAO',
        'PROMOCAO',
        'MERITO',
        'SUBSTITUICAO',
        'AUMENTO_DE_QUADRO',
        'DESLIGAMENTO'
      );

      ALTER TABLE budget_entries
        ALTER COLUMN cost_center_id SET NOT NULL,
        ADD CONSTRAINT budget_entries_cost_center_id_fkey
          FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE RESTRICT,
        ADD COLUMN movement_type planned_situation NOT NULL DEFAULT 'SEM_MOVIMENTACAO',
        ADD COLUMN "jan" NUMERIC(14,2),
        ADD COLUMN "fev" NUMERIC(14,2),
        ADD COLUMN "mar" NUMERIC(14,2),
        ADD COLUMN "abr" NUMERIC(14,2),
        ADD COLUMN "mai" NUMERIC(14,2),
        ADD COLUMN "jun" NUMERIC(14,2),
        ADD COLUMN "jul" NUMERIC(14,2),
        ADD COLUMN "ago" NUMERIC(14,2),
        ADD COLUMN "set" NUMERIC(14,2),
        ADD COLUMN "out" NUMERIC(14,2),
        ADD COLUMN "nov" NUMERIC(14,2),
        ADD COLUMN "dez" NUMERIC(14,2);

      ALTER TABLE budget_entries ALTER COLUMN movement_type DROP DEFAULT;

      DROP INDEX IF EXISTS idx_budget_entries_employee;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE budget_entries DROP CONSTRAINT IF EXISTS budget_entries_cost_center_id_fkey;

      ALTER TABLE budget_entries
        DROP COLUMN IF EXISTS movement_type,
        DROP COLUMN IF EXISTS "jan",
        DROP COLUMN IF EXISTS "fev",
        DROP COLUMN IF EXISTS "mar",
        DROP COLUMN IF EXISTS "abr",
        DROP COLUMN IF EXISTS "mai",
        DROP COLUMN IF EXISTS "jun",
        DROP COLUMN IF EXISTS "jul",
        DROP COLUMN IF EXISTS "ago",
        DROP COLUMN IF EXISTS "set",
        DROP COLUMN IF EXISTS "out",
        DROP COLUMN IF EXISTS "nov",
        DROP COLUMN IF EXISTS "dez";

      DROP TYPE IF EXISTS planned_situation;
      CREATE TYPE planned_situation AS ENUM (
        'SEM_MOVIMENTACAO','PROMOCAO','MERITO','TRANSFERENCIA','NOVA_VAGA'
      );

      ALTER TABLE budget_entries
        ALTER COLUMN cost_center_id DROP NOT NULL,
        ADD CONSTRAINT budget_entries_cost_center_id_fkey
          FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
        ADD COLUMN registration VARCHAR(30),
        ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        ADD COLUMN name VARCHAR(200),
        ADD COLUMN management_id UUID REFERENCES managements(id) ON DELETE SET NULL,
        ADD COLUMN coordination_id UUID REFERENCES coordinations(id) ON DELETE SET NULL,
        ADD COLUMN city VARCHAR(120),
        ADD COLUMN state CHAR(2),
        ADD COLUMN contract_type contract_type NOT NULL DEFAULT 'CLT',
        ADD COLUMN admission_date DATE,
        ADD COLUMN current_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN planned_situation planned_situation NOT NULL DEFAULT 'SEM_MOVIMENTACAO',
        ADD COLUMN planned_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN planned_month SMALLINT CHECK (planned_month BETWEEN 1 AND 12),
        ADD COLUMN monthly_budgeted_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN annual_budgeted_cost NUMERIC(14,2) NOT NULL DEFAULT 0;

      CREATE INDEX idx_budget_entries_employee ON budget_entries(employee_id);
    `);
  }
}
