-- ============================================================================
-- Sistema de Gestão de Movimentações Salariais, Estudos Salariais e
-- Controle Orçamentário de Pessoal
-- PostgreSQL 14+
--
-- Este script é a referência canônica do modelo de dados (DER em
-- database/DER.md). Em runtime, o schema é criado/versionado pelas
-- migrations do TypeORM em backend/src/migrations — este arquivo serve
-- para provisionamento manual, revisão e documentação.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'RH_REMUNERACAO',
  'DIRETOR',
  'GESTOR'
);

CREATE TYPE contract_type AS ENUM (
  'CLT',
  'PJ',
  'ESTAGIO',
  'APRENDIZ',
  'TEMPORARIO'
);

CREATE TYPE employee_status AS ENUM (
  'ATIVO',
  'INATIVO',
  'AFASTADO'
);

-- "Tipo de movimentação" de uma linha de orçamento (budget_entries.movement_type)
CREATE TYPE planned_situation AS ENUM (
  'SEM_MOVIMENTACAO',
  'PROMOCAO',
  'MERITO',
  'SUBSTITUICAO',
  'AUMENTO_DE_QUADRO',
  'DESLIGAMENTO'
);

CREATE TYPE movement_type AS ENUM (
  'PROMOCAO',
  'MERITO',
  'AUMENTO_QUADRO'
);

-- O fluxo de aprovação agora é configurável (ver approval_workflow_steps) —
-- a movimentação tem um único status "em aprovação" genérico; a etapa ativa
-- é derivada dinamicamente (menor step_order ainda PENDENTE em approval_steps).
CREATE TYPE movement_status AS ENUM (
  'RASCUNHO',
  'PENDENTE_APROVACAO',
  'APROVADO',
  'REPROVADO',
  'CANCELADO'
);

CREATE TYPE approval_status AS ENUM (
  'PENDENTE',
  'APROVADO',
  'REPROVADO',
  'PULADO'
);

CREATE TYPE import_type AS ENUM (
  'ORCAMENTO',
  'BASE_COLABORADORES',
  'ESTUDO_SALARIAL',
  'CENTRO_CUSTO'
);

CREATE TYPE import_status AS ENUM (
  'PROCESSANDO',
  'CONCLUIDO',
  'CONCLUIDO_COM_ERROS',
  'FALHOU'
);

CREATE TYPE market_position AS ENUM (
  'ABAIXO_DO_MERCADO',
  'DENTRO_DO_MERCADO',
  'ACIMA_DO_MERCADO'
);

CREATE TYPE charge_value_type AS ENUM (
  'PERCENTUAL',
  'FIXO'
);

-- ============================================================================
-- ESTRUTURA ORGANIZACIONAL
-- ============================================================================

CREATE TABLE directorates ( -- Diretorias
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  annual_budget NUMERIC(16,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE managements ( -- Gerências
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (directorate_id, name)
);

CREATE TABLE coordinations ( -- Coordenações
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_id UUID NOT NULL REFERENCES managements(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (management_id, name)
);

CREATE TABLE positions ( -- Cargos
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  career_level VARCHAR(50),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cost_centers ( -- Centros de custo
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- USUÁRIOS E ACESSO
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL, -- escopo do DIRETOR (diretoria inteira)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Escopo do GESTOR: multi-seleção de centros de custo (em vez de uma
-- diretoria inteira, como o Diretor) — ele só enxerga colaboradores e
-- orçamento dos centros de custo aqui listados. Ausência de linhas = não
-- vê nada (nunca "vê tudo" por omissão).
CREATE TABLE user_cost_centers (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, cost_center_id)
);

CREATE INDEX idx_user_cost_centers_cost_center ON user_cost_centers(cost_center_id);

-- ============================================================================
-- IMPORTAÇÕES (rastreabilidade de cargas em massa)
-- ============================================================================

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

-- ============================================================================
-- COLABORADORES (BASE ATUAL)
-- ============================================================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration VARCHAR(30) NOT NULL UNIQUE, -- matrícula
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

-- Fechamento mensal da folha: um "retrato" do salário de cada colaborador no
-- mês em que a base foi fechada (ver POST /employees/import, coluna
-- mes_de_referencia da planilha, formato MM/AAAA).
-- employees.current_salary é um valor único e vivo — sem isso, um relatório
-- de um mês passado mostraria o salário mais recente para todos os meses.
-- Os relatórios usam EXCLUSIVAMENTE o snapshot do mês exato pedido, nunca
-- employees.current_salary ao vivo; sem snapshot para o mês pedido, os
-- indicadores desse mês vêm zerados (monthClosed: false na API) — cair para
-- current_salary faria um mês sem fechamento "herdar" os números do último
-- mês fechado, como se as folhas tivessem sido somadas entre meses.
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

-- ============================================================================
-- ORÇAMENTO ANUAL (HC + FOLHA ORÇADA)
-- ============================================================================

-- Linha de orçamento: (ano, diretoria, centro de custo, cargo, tipo de
-- movimentação) + custo orçado mês a mês. NÃO é vinculada a um colaborador —
-- o orçamento é por diretoria/centro de custo/cargo, não por matrícula.
-- Múltiplas linhas podem repetir a mesma combinação diretoria+centro de
-- custo+cargo+tipo (cada linha = uma vaga/assento orçado; não há chave
-- única natural além do id).
CREATE TABLE budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  movement_type planned_situation NOT NULL,
  jan NUMERIC(14,2),
  fev NUMERIC(14,2),
  mar NUMERIC(14,2),
  abr NUMERIC(14,2),
  mai NUMERIC(14,2),
  jun NUMERIC(14,2),
  jul NUMERIC(14,2),
  ago NUMERIC(14,2),
  "set" NUMERIC(14,2),
  "out" NUMERIC(14,2),
  nov NUMERIC(14,2),
  dez NUMERIC(14,2),
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_entries_year ON budget_entries(year);
CREATE INDEX idx_budget_entries_directorate ON budget_entries(directorate_id);
CREATE INDEX idx_budget_entries_cost_center ON budget_entries(cost_center_id);
CREATE INDEX idx_budget_entries_position ON budget_entries(position_id);

-- ============================================================================
-- PARÂMETROS DE ENCARGOS E BENEFÍCIOS
-- ============================================================================

CREATE TABLE charge_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE, -- ex: INSS_PATRONAL, FGTS, FERIAS, DECIMO_TERCEIRO, BENEFICIOS
  label VARCHAR(150) NOT NULL,
  value_type charge_value_type NOT NULL DEFAULT 'PERCENTUAL',
  value NUMERIC(10,4) NOT NULL, -- percentual (ex 20.0000 = 20%) ou valor fixo em R$
  is_benefit BOOLEAN NOT NULL DEFAULT FALSE, -- true = compõe "benefícios", false = "encargos"
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MOVIMENTAÇÕES (SOLICITAÇÕES)
-- ============================================================================

CREATE TABLE movement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type movement_type NOT NULL,
  status movement_status NOT NULL DEFAULT 'RASCUNHO',

  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT, -- nulo em AUMENTO_QUADRO
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE RESTRICT,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE RESTRICT, -- promoção/mérito: do colaborador; aumento de quadro: obrigatório na solicitação

  current_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
  new_position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,

  current_salary NUMERIC(14,2), -- promoção/mérito
  new_salary NUMERIC(14,2),     -- promoção/mérito

  merit_percentage NUMERIC(6,3), -- mérito (%)

  quantity INT, -- aumento de quadro (qtde de vagas)
  planned_salary NUMERIC(14,2), -- aumento de quadro (salário previsto)

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
CREATE INDEX idx_movement_requests_cost_center ON movement_requests(cost_center_id);
CREATE INDEX idx_movement_requests_employee ON movement_requests(employee_id);
CREATE INDEX idx_movement_requests_type ON movement_requests(type);

-- ============================================================================
-- SIMULAÇÕES DE IMPACTO (snapshot calculado por movimentação)
-- ============================================================================

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

-- ============================================================================
-- WORKFLOW DE APROVAÇÃO (configurável — ver Administração > Fluxo de Aprovação)
-- ============================================================================

-- Configuração do fluxo: uma sequência de etapas ordenadas por step_order;
-- cada etapa tem um conjunto de perfis (roles, valores de ApproverRole) e é
-- decidida por QUALQUER UM deles, o que agir primeiro. `roles` é TEXT[] (não
-- um enum Postgres) de propósito — a lista de perfis válidos é definida em
-- ApproverRole (TypeScript) e pode mudar sem nova migration. A tabela
-- inteira é substituída a cada salvamento (ver ApprovalWorkflowService).
CREATE TABLE approval_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order SMALLINT NOT NULL UNIQUE,
  roles TEXT[] NOT NULL CHECK (array_length(roles, 1) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma ApprovalStep por etapa configurada, criada ao submeter a movimentação
-- (snapshot dos perfis elegíveis daquele momento em eligible_roles — mudar o
-- fluxo depois não afeta solicitações já em andamento). decided_by_role
-- registra qual perfil de fato decidiu (auditoria), nulo enquanto PENDENTE.
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_request_id UUID NOT NULL REFERENCES movement_requests(id) ON DELETE CASCADE,
  step_order SMALLINT NOT NULL,
  eligible_roles TEXT[] NOT NULL,
  decided_by_role TEXT,
  approver_user_id UUID REFERENCES users(id),
  status approval_status NOT NULL DEFAULT 'PENDENTE',
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (movement_request_id, step_order)
);

CREATE INDEX idx_approval_steps_request ON approval_steps(movement_request_id);
CREATE INDEX idx_approval_steps_status ON approval_steps(status);

-- ============================================================================
-- HISTÓRICO DE MOVIMENTAÇÕES APROVADAS (snapshot imutável para auditoria)
-- ============================================================================

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

-- ============================================================================
-- ESTUDOS SALARIAIS (BENCHMARK DE MERCADO)
-- ============================================================================

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

-- ============================================================================
-- AUDITORIA
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, APPROVE, REJECT, IMPORT...
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
