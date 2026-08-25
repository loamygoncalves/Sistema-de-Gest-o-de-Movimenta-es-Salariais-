import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fechamento mensal da folha — ver payroll-snapshot.entity.ts. Uma linha por
 * (year, month, employee) com o salário "congelado" no momento em que o mês
 * foi fechado (ver EmployeesService#importFromExcel com year/month
 * informados). Onde não houver snapshot para um mês, os relatórios caem
 * para `employees.current_salary` ao vivo (fallback) — nenhum dado
 * histórico existente é migrado por esta migration, já que não há como
 * reconstruir retroativamente o que a folha era em cada mês passado.
 */
export class PayrollSnapshots1700000006000 implements MigrationInterface {
  name = 'PayrollSnapshots1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year SMALLINT NOT NULL,
        month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        directorate_id UUID NOT NULL REFERENCES directorates(id),
        cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
        position_id UUID NOT NULL REFERENCES positions(id),
        salary NUMERIC(14,2) NOT NULL CHECK (salary >= 0),
        import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (year, month, employee_id)
      );

      CREATE INDEX idx_payroll_snapshots_year_month ON payroll_snapshots(year, month);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS payroll_snapshots;
    `);
  }
}
