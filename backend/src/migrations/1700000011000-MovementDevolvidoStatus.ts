import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fluxo de devolutiva: quando um aprovador recusa uma movimentação
 * (ApprovalsService#reject), em vez de encerrar definitivamente
 * (REPROVADO), ela agora volta para a caixa de quem solicitou — status
 * DEVOLVIDO — junto com o motivo (comment do approval_step recusado). O
 * solicitante pode editar e reenviar (MovementsService#submit reinicia o
 * fluxo de aprovação do zero, ver ApprovalsService#clearStepsForMovement).
 * REPROVADO permanece no enum (histórico existente, e nenhum código novo
 * volta a produzi-lo).
 */
export class MovementDevolvidoStatus1700000011000 implements MigrationInterface {
  name = 'MovementDevolvidoStatus1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE movement_status ADD VALUE 'DEVOLVIDO';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE movement_requests SET status = 'REPROVADO' WHERE status = 'DEVOLVIDO';

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE VARCHAR(30) USING status::text;

      DROP TYPE movement_status;
      CREATE TYPE movement_status AS ENUM (
        'RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADO', 'REPROVADO', 'CANCELADO'
      );

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE movement_status USING status::movement_status,
        ALTER COLUMN status SET DEFAULT 'RASCUNHO';
    `);
  }
}
