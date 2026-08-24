import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o schema completo do banco (enums + tabelas + índices), espelhando
 * database/schema.sql. Mantido como um único DDL bruto — em vez de
 * gerado por diff do TypeORM — para que este arquivo seja a fonte
 * legível/auditável do schema inicial do projeto.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('ADMIN','RH_REMUNERACAO','DIRETOR','FINANCEIRO','GESTOR');
      CREATE TYPE contract_type AS ENUM ('CLT','PJ','ESTAGIO','APRENDIZ','TEMPORARIO');
      CREATE TYPE employee_status AS ENUM ('ATIVO','INATIVO','AFASTADO');
      CREATE TYPE planned_situation AS ENUM ('SEM_MOVIMENTACAO','PROMOCAO','MERITO','TRANSFERENCIA','NOVA_VAGA');
      CREATE TYPE movement_type AS ENUM ('PROMOCAO','MERITO','AUMENTO_QUADRO','TRANSFERENCIA');
      CREATE TYPE movement_status AS ENUM ('RASCUNHO','PENDENTE_DIRETOR','PENDENTE_RH','PENDENTE_FINANCEIRO','APROVADO','REPROVADO','CANCELADO');
      CREATE TYPE approver_role AS ENUM ('DIRETOR','RH_REMUNERACAO','FINANCEIRO');
      CREATE TYPE approval_status AS ENUM ('PENDENTE','APROVADO','REPROVADO','PULADO');
      CREATE TYPE import_type AS ENUM ('ORCAMENTO','BASE_COLABORADORES','ESTUDO_SALARIAL');
      CREATE TYPE import_status AS ENUM ('PROCESSANDO','CONCLUIDO','CONCLUIDO_COM_ERROS','FALHOU');
      CREATE TYPE market_position AS ENUM ('ABAIXO_DO_MERCADO','DENTRO_DO_MERCADO','ACIMA_DO_MERCADO');
      CREATE TYPE charge_value_type AS ENUM ('PERCENTUAL','FIXO');
    `);

    await queryRunner.query(`
      CREATE TABLE directorates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL UNIQUE,
        annual_budget NUMERIC(16,2) NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE managements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
        name VARCHAR(150) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (directorate_id, name)
      );

      CREATE TABLE coordinations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        management_id UUID NOT NULL REFERENCES managements(id) ON DELETE RESTRICT,
        name VARCHAR(150) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (management_id, name)
      );

      CREATE TABLE positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL UNIQUE,
        career_level VARCHAR(50),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE cost_centers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        email VARCHAR(200) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE import_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type import_type NOT NULL,
        filename VARCHAR(255) NOT NULL,
        reference_year INT,
        imported_by UUID NOT NULL REFERENCES users(id),
        status import_status NOT NULL DEFAULT 'PROCESSANDO',
        total_rows INT NOT NULL DEFAULT 0,
        success_rows INT NOT NULL DEFAULT 0,
        error_rows INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ
      );

      CREATE TABLE import_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
        row_number INT NOT NULL,
        field VARCHAR(100),
        message VARCHAR(500) NOT NULL
      );
      CREATE INDEX idx_import_errors_batch ON import_errors(batch_id);

      CREATE TABLE employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        registration VARCHAR(30) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
        directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
        management_id UUID REFERENCES managements(id) ON DELETE SET NULL,
        coordination_id UUID REFERENCES coordinations(id) ON DELETE SET NULL,
        cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
        city VARCHAR(120),
        state CHAR(2),
        contract_type contract_type NOT NULL DEFAULT 'CLT',
        admission_date DATE NOT NULL,
        current_salary NUMERIC(14,2) NOT NULL CHECK (current_salary >= 0),
        status employee_status NOT NULL DEFAULT 'ATIVO',
        last_import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_employees_directorate ON employees(directorate_id);
      CREATE INDEX idx_employees_position ON employees(position_id);
      CREATE INDEX idx_employees_status ON employees(status);

      CREATE TABLE budget_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year INT NOT NULL,
        registration VARCHAR(30),
        employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        name VARCHAR(200),
        position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
        directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
        management_id UUID REFERENCES managements(id) ON DELETE SET NULL,
        coordination_id UUID REFERENCES coordinations(id) ON DELETE SET NULL,
        cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
        city VARCHAR(120),
        state CHAR(2),
        contract_type contract_type NOT NULL DEFAULT 'CLT',
        admission_date DATE,
        current_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
        planned_situation planned_situation NOT NULL DEFAULT 'SEM_MOVIMENTACAO',
        planned_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
        planned_month SMALLINT CHECK (planned_month BETWEEN 1 AND 12),
        monthly_budgeted_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        annual_budgeted_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (year, registration)
      );
      CREATE INDEX idx_budget_entries_year ON budget_entries(year);
      CREATE INDEX idx_budget_entries_directorate ON budget_entries(directorate_id);
      CREATE INDEX idx_budget_entries_employee ON budget_entries(employee_id);

      CREATE TABLE charge_parameters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(150) NOT NULL,
        value_type charge_value_type NOT NULL DEFAULT 'PERCENTUAL',
        value NUMERIC(10,4) NOT NULL,
        is_benefit BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE movement_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type movement_type NOT NULL,
        status movement_status NOT NULL DEFAULT 'RASCUNHO',
        employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
        directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
        current_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
        new_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
        current_salary NUMERIC(14,2),
        new_salary NUMERIC(14,2),
        merit_percentage NUMERIC(6,3),
        quantity INT,
        planned_salary NUMERIC(14,2),
        origin_directorate_id UUID REFERENCES directorates(id),
        destination_directorate_id UUID REFERENCES directorates(id),
        effective_date DATE NOT NULL,
        justification TEXT NOT NULL,
        requested_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_promotion_salary CHECK (
          type <> 'PROMOCAO' OR (new_salary IS NOT NULL AND current_salary IS NOT NULL AND new_salary >= current_salary)
        )
      );
      CREATE INDEX idx_movement_requests_status ON movement_requests(status);
      CREATE INDEX idx_movement_requests_directorate ON movement_requests(directorate_id);
      CREATE INDEX idx_movement_requests_employee ON movement_requests(employee_id);
      CREATE INDEX idx_movement_requests_type ON movement_requests(type);

      CREATE TABLE movement_simulations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        movement_request_id UUID NOT NULL REFERENCES movement_requests(id) ON DELETE CASCADE,
        months_remaining INT NOT NULL,
        monthly_salary_impact NUMERIC(14,2) NOT NULL,
        annual_salary_impact NUMERIC(14,2) NOT NULL,
        charges_total NUMERIC(14,2) NOT NULL,
        benefits_total NUMERIC(14,2) NOT NULL,
        total_monthly_impact NUMERIC(14,2) NOT NULL,
        total_annual_impact NUMERIC(14,2) NOT NULL,
        budgeted_directorate_payroll NUMERIC(16,2) NOT NULL,
        current_directorate_payroll NUMERIC(16,2) NOT NULL,
        payroll_after_approval NUMERIC(16,2) NOT NULL,
        difference NUMERIC(16,2) NOT NULL,
        percent_consumed NUMERIC(7,3) NOT NULL,
        exceeds_budget BOOLEAN NOT NULL DEFAULT FALSE,
        alert_message VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_movement_simulations_request ON movement_simulations(movement_request_id);

      CREATE TABLE approval_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        movement_request_id UUID NOT NULL REFERENCES movement_requests(id) ON DELETE CASCADE,
        step_order SMALLINT NOT NULL,
        approver_role approver_role NOT NULL,
        approver_user_id UUID REFERENCES users(id),
        status approval_status NOT NULL DEFAULT 'PENDENTE',
        comment TEXT,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (movement_request_id, step_order)
      );
      CREATE INDEX idx_approval_steps_request ON approval_steps(movement_request_id);
      CREATE INDEX idx_approval_steps_status ON approval_steps(status);

      CREATE TABLE movement_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        movement_request_id UUID NOT NULL REFERENCES movement_requests(id),
        employee_id UUID REFERENCES employees(id),
        type movement_type NOT NULL,
        directorate_id UUID NOT NULL REFERENCES directorates(id),
        position_id UUID REFERENCES positions(id),
        cost_center_id UUID REFERENCES cost_centers(id),
        previous_salary NUMERIC(14,2),
        new_salary NUMERIC(14,2),
        effective_date DATE NOT NULL,
        approved_at TIMESTAMPTZ NOT NULL,
        monthly_impact NUMERIC(14,2) NOT NULL,
        annual_impact NUMERIC(14,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_movement_history_directorate ON movement_history(directorate_id);
      CREATE INDEX idx_movement_history_type ON movement_history(type);
      CREATE INDEX idx_movement_history_effective_date ON movement_history(effective_date);

      CREATE TABLE salary_studies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        source VARCHAR(200),
        reference_year INT NOT NULL,
        imported_by UUID NOT NULL REFERENCES users(id),
        import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE salary_study_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_id UUID NOT NULL REFERENCES salary_studies(id) ON DELETE CASCADE,
        position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
        company_name VARCHAR(200),
        min_salary NUMERIC(14,2),
        avg_salary NUMERIC(14,2),
        max_salary NUMERIC(14,2),
        p25 NUMERIC(14,2),
        p50 NUMERIC(14,2),
        p75 NUMERIC(14,2),
        p90 NUMERIC(14,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_salary_study_entries_study ON salary_study_entries(study_id);
      CREATE INDEX idx_salary_study_entries_position ON salary_study_entries(position_id);

      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id UUID,
        before JSONB,
        after JSONB,
        ip_address VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS salary_study_entries;
      DROP TABLE IF EXISTS salary_studies;
      DROP TABLE IF EXISTS movement_history;
      DROP TABLE IF EXISTS approval_steps;
      DROP TABLE IF EXISTS movement_simulations;
      DROP TABLE IF EXISTS movement_requests;
      DROP TABLE IF EXISTS charge_parameters;
      DROP TABLE IF EXISTS budget_entries;
      DROP TABLE IF EXISTS employees;
      DROP TABLE IF EXISTS import_errors;
      DROP TABLE IF EXISTS import_batches;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS cost_centers;
      DROP TABLE IF EXISTS positions;
      DROP TABLE IF EXISTS coordinations;
      DROP TABLE IF EXISTS managements;
      DROP TABLE IF EXISTS directorates;

      DROP TYPE IF EXISTS charge_value_type;
      DROP TYPE IF EXISTS market_position;
      DROP TYPE IF EXISTS import_status;
      DROP TYPE IF EXISTS import_type;
      DROP TYPE IF EXISTS approval_status;
      DROP TYPE IF EXISTS approver_role;
      DROP TYPE IF EXISTS movement_status;
      DROP TYPE IF EXISTS movement_type;
      DROP TYPE IF EXISTS planned_situation;
      DROP TYPE IF EXISTS employee_status;
      DROP TYPE IF EXISTS contract_type;
      DROP TYPE IF EXISTS user_role;
    `);
  }
}
