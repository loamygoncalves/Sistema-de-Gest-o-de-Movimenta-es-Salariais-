import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Política de Remuneração (tela ADMIN/RH_REMUNERACAO): limites globais
 * opcionais (% máximo de reajuste de Mérito, % máximo de Promoção, meses
 * mínimos entre reajustes de um mesmo colaborador) — uma única linha
 * (singleton). Substitui o alerta fixo via env `MAX_INCREASE_PERCENT_ALERT`
 * (não mais admin-editável, não separava Mérito de Promoção). Violar a
 * política nunca bloqueia — `movement_simulations.policy_violations` guarda
 * as mensagens de violação (vazio/nulo = aderente), visíveis tanto para
 * quem simula quanto para quem aprova.
 */
export class RemunerationPolicy1700000008000 implements MigrationInterface {
  name = 'RemunerationPolicy1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE remuneration_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        max_merit_percent NUMERIC(6,3),
        max_promotion_percent NUMERIC(6,3),
        min_months_between_raises INT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE movement_simulations
        ADD COLUMN policy_violations TEXT[];
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE movement_simulations
        DROP COLUMN policy_violations;

      DROP TABLE remuneration_policies;
    `);
  }
}
