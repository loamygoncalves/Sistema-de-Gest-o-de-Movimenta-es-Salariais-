import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela de junção para o escopo de Gestor por centro de custo (múltiplos)
 * — Diretor continua escopado por users.directorate_id (diretoria inteira);
 * Gestor passa a ser escopado por um conjunto de centros de custo em vez de
 * diretoria inteira. Ver common/decorators/current-user.decorator.ts.
 */
export class UserCostCenters1700000004000 implements MigrationInterface {
  name = 'UserCostCenters1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_cost_centers (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, cost_center_id)
      );
      CREATE INDEX idx_user_cost_centers_cost_center ON user_cost_centers(cost_center_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_cost_centers;`);
  }
}
