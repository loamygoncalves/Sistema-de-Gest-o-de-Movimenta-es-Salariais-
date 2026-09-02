import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca por Cargo se o salário dos colaboradores desse cargo deve ficar
 * oculto para o perfil GESTOR — ex.: Gerente/Diretor, para que o gestor de
 * uma área não veja o salário de cargos hierarquicamente acima do time
 * dele. Não afeta ADMIN/RH_REMUNERACAO/DIRETOR/FINANCEIRO, que sempre veem
 * o salário. Aplicado em EmployeesService (mascarado no response, não só na
 * UI) — ver `hideSalaryFromManager` em Position.
 */
export class PositionHideSalaryFromManager1700000010000 implements MigrationInterface {
  name = 'PositionHideSalaryFromManager1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE positions
        ADD COLUMN hide_salary_from_manager BOOLEAN NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE positions
        DROP COLUMN hide_salary_from_manager;
    `);
  }
}
