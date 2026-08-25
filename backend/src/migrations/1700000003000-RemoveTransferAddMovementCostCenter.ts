import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) Remove o tipo de movimentação TRANSFERENCIA (não será mais usado) — o
 *    Postgres não permite remover um valor de enum diretamente, então o tipo
 *    é recriado (mesmo padrão de RedesignBudgetEntries). Movimentações
 *    existentes do tipo TRANSFERENCIA (e seus registros dependentes) são
 *    removidas antes da recriação, já que não há um tipo equivalente para
 *    migrá-las — aceitável neste estágio (base de teste/demonstração).
 * 2) Remove origin_directorate_id/destination_directorate_id de
 *    movement_requests — colunas usadas apenas por TRANSFERENCIA.
 * 3) Adiciona cost_center_id a movement_requests: para PROMOÇÃO/MÉRITO vem
 *    do centro de custo do colaborador; para AUMENTO_QUADRO passa a ser
 *    obrigatório no cadastro (fecha o bucket diretoria+centro de
 *    custo+cargo igual ao orçamento). Necessário para o escopo de Gestor
 *    por centro de custo e para a comparação com o orçamento por bucket.
 */
export class RemoveTransferAddMovementCostCenter1700000003000 implements MigrationInterface {
  name = 'RemoveTransferAddMovementCostCenter1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM movement_history WHERE movement_request_id IN (
        SELECT id FROM movement_requests WHERE type = 'TRANSFERENCIA'
      );
      DELETE FROM approval_steps WHERE movement_request_id IN (
        SELECT id FROM movement_requests WHERE type = 'TRANSFERENCIA'
      );
      DELETE FROM movement_simulations WHERE movement_request_id IN (
        SELECT id FROM movement_requests WHERE type = 'TRANSFERENCIA'
      );
      DELETE FROM movement_requests WHERE type = 'TRANSFERENCIA';

      ALTER TABLE movement_requests DROP CONSTRAINT IF EXISTS chk_promotion_salary;

      ALTER TABLE movement_requests
        ALTER COLUMN type TYPE VARCHAR(30) USING type::text;
      ALTER TABLE movement_history
        ALTER COLUMN type TYPE VARCHAR(30) USING type::text;

      DROP TYPE movement_type;
      CREATE TYPE movement_type AS ENUM ('PROMOCAO','MERITO','AUMENTO_QUADRO');

      ALTER TABLE movement_requests
        ALTER COLUMN type TYPE movement_type USING type::movement_type;
      ALTER TABLE movement_history
        ALTER COLUMN type TYPE movement_type USING type::movement_type;

      ALTER TABLE movement_requests ADD CONSTRAINT chk_promotion_salary CHECK (
        type <> 'PROMOCAO' OR (new_salary IS NOT NULL AND current_salary IS NOT NULL AND new_salary >= current_salary)
      );

      ALTER TABLE movement_requests
        DROP COLUMN IF EXISTS origin_directorate_id,
        DROP COLUMN IF EXISTS destination_directorate_id;

      ALTER TABLE movement_requests
        ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE RESTRICT;
      CREATE INDEX idx_movement_requests_cost_center ON movement_requests(cost_center_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_movement_requests_cost_center;
      ALTER TABLE movement_requests DROP COLUMN IF EXISTS cost_center_id;

      ALTER TABLE movement_requests
        ADD COLUMN origin_directorate_id UUID REFERENCES directorates(id),
        ADD COLUMN destination_directorate_id UUID REFERENCES directorates(id);

      ALTER TABLE movement_requests DROP CONSTRAINT IF EXISTS chk_promotion_salary;

      ALTER TABLE movement_requests
        ALTER COLUMN type TYPE VARCHAR(30) USING type::text;
      ALTER TABLE movement_history
        ALTER COLUMN type TYPE VARCHAR(30) USING type::text;

      DROP TYPE movement_type;
      CREATE TYPE movement_type AS ENUM ('PROMOCAO','MERITO','AUMENTO_QUADRO','TRANSFERENCIA');

      ALTER TABLE movement_requests
        ALTER COLUMN type TYPE movement_type USING type::movement_type;
      ALTER TABLE movement_history
        ALTER COLUMN type TYPE movement_type USING type::movement_type;

      ALTER TABLE movement_requests ADD CONSTRAINT chk_promotion_salary CHECK (
        type <> 'PROMOCAO' OR (new_salary IS NOT NULL AND current_salary IS NOT NULL AND new_salary >= current_salary)
      );
    `);
  }
}
