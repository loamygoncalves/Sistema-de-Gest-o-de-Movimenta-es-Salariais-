import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fluxo de aprovação deixa de ser fixo (Diretor → RH Remuneração →
 * Financeiro) e passa a ser configurável pelo ADMIN (tela "Fluxo de
 * Aprovação"): uma sequência de etapas, cada uma com um conjunto de perfis
 * — qualquer um deles decide a etapa (ex.: "RH Remuneração OU Admin").
 *
 * 1) Cria `approval_workflow_steps` (a configuração) e semeia o fluxo
 *    padrão pedido: etapa 1 = RH Remuneração ou Admin; etapa 2 = Diretor.
 * 2) `approval_steps.approver_role` (um único perfil fixo, enum) vira
 *    `eligible_roles` (texto[], snapshot dos perfis elegíveis daquela
 *    etapa no momento da submissão) + `decided_by_role` (perfil de quem
 *    de fato decidiu, para auditoria). Deixam de ser um Postgres enum —
 *    a lista de perfis é definida em `ApproverRole` (TypeScript) e pode
 *    mudar sem nova migration.
 * 3) `movement_requests.status` perde os valores nomeados por etapa
 *    (`PENDENTE_DIRETOR`/`PENDENTE_RH`/`PENDENTE_FINANCEIRO`) em favor de
 *    um único `PENDENTE_APROVACAO` genérico — qual etapa está ativa passa
 *    a ser lido de `approval_steps` (a de menor `step_order` ainda
 *    `PENDENTE`), não mais do status da movimentação.
 * 4) Remove o perfil FINANCEIRO do sistema (`user_role`): usuários
 *    existentes com esse perfil são desativados e reatribuídos para
 *    RH_REMUNERACAO (não há um perfil equivalente — fica marcado inativo
 *    para um ADMIN revisar e reatribuir corretamente).
 *
 * A reversão (down) é best-effort: como o Postgres não guarda "qual dos 3
 * status antigos" um `PENDENTE_APROVACAO` era, movimentações em andamento
 * voltam todas para `PENDENTE_DIRETOR`; e o perfil original dos usuários
 * FINANCEIRO reatribuídos não é recuperado (mesma natureza lossy da
 * migration RemoveTransferAddMovementCostCenter).
 */
export class ConfigurableApprovalWorkflow1700000005000 implements MigrationInterface {
  name = 'ConfigurableApprovalWorkflow1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE approval_workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        step_order SMALLINT NOT NULL UNIQUE,
        roles TEXT[] NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_approval_workflow_step_roles CHECK (array_length(roles, 1) > 0)
      );

      INSERT INTO approval_workflow_steps (step_order, roles) VALUES
        (1, ARRAY['RH_REMUNERACAO', 'ADMIN']),
        (2, ARRAY['DIRETOR']);

      ALTER TABLE approval_steps
        ADD COLUMN eligible_roles TEXT[],
        ADD COLUMN decided_by_role TEXT;

      UPDATE approval_steps
      SET eligible_roles = ARRAY[approver_role::text],
          decided_by_role = CASE WHEN status IN ('APROVADO', 'REPROVADO') THEN approver_role::text ELSE NULL END;

      ALTER TABLE approval_steps
        ALTER COLUMN eligible_roles SET NOT NULL,
        DROP COLUMN approver_role;

      DROP TYPE approver_role;

      UPDATE movement_requests
      SET status = 'PENDENTE_APROVACAO'
      WHERE status IN ('PENDENTE_DIRETOR', 'PENDENTE_RH', 'PENDENTE_FINANCEIRO');

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE VARCHAR(30) USING status::text;

      DROP TYPE movement_status;
      CREATE TYPE movement_status AS ENUM (
        'RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADO', 'REPROVADO', 'CANCELADO'
      );

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE movement_status USING status::movement_status,
        ALTER COLUMN status SET DEFAULT 'RASCUNHO';

      UPDATE users SET role = 'RH_REMUNERACAO', active = false WHERE role = 'FINANCEIRO';

      ALTER TABLE users
        ALTER COLUMN role TYPE VARCHAR(30) USING role::text;

      DROP TYPE user_role;
      CREATE TYPE user_role AS ENUM ('ADMIN', 'RH_REMUNERACAO', 'DIRETOR', 'GESTOR');

      ALTER TABLE users
        ALTER COLUMN role TYPE user_role USING role::user_role;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ALTER COLUMN role TYPE VARCHAR(30) USING role::text;

      DROP TYPE user_role;
      CREATE TYPE user_role AS ENUM ('ADMIN', 'RH_REMUNERACAO', 'DIRETOR', 'FINANCEIRO', 'GESTOR');

      ALTER TABLE users
        ALTER COLUMN role TYPE user_role USING role::user_role;

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE VARCHAR(30) USING status::text;

      UPDATE movement_requests SET status = 'PENDENTE_DIRETOR' WHERE status = 'PENDENTE_APROVACAO';

      DROP TYPE movement_status;
      CREATE TYPE movement_status AS ENUM (
        'RASCUNHO', 'PENDENTE_DIRETOR', 'PENDENTE_RH', 'PENDENTE_FINANCEIRO',
        'APROVADO', 'REPROVADO', 'CANCELADO'
      );

      ALTER TABLE movement_requests
        ALTER COLUMN status TYPE movement_status USING status::movement_status,
        ALTER COLUMN status SET DEFAULT 'RASCUNHO';

      CREATE TYPE approver_role AS ENUM ('DIRETOR', 'RH_REMUNERACAO', 'FINANCEIRO');

      ALTER TABLE approval_steps ADD COLUMN approver_role approver_role;
      UPDATE approval_steps SET approver_role = eligible_roles[1]::approver_role
        WHERE eligible_roles[1] IN ('DIRETOR', 'RH_REMUNERACAO', 'FINANCEIRO');
      UPDATE approval_steps SET approver_role = 'DIRETOR' WHERE approver_role IS NULL;

      ALTER TABLE approval_steps
        ALTER COLUMN approver_role SET NOT NULL,
        DROP COLUMN eligible_roles,
        DROP COLUMN decided_by_role;

      DROP TABLE approval_workflow_steps;
    `);
  }
}
