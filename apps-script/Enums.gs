/**
 * Enumeradores do domínio — espelham backend/src/common/enums/index.ts do
 * projeto NestJS original, mantidos como strings simples (Apps Script não
 * tem enum nativo).
 */

var UserRole = {
  ADMIN: 'ADMIN',
  RH_REMUNERACAO: 'RH_REMUNERACAO',
  DIRETOR: 'DIRETOR',
  FINANCEIRO: 'FINANCEIRO',
  GESTOR: 'GESTOR',
};

var ContractType = {
  CLT: 'CLT',
  PJ: 'PJ',
  ESTAGIO: 'ESTAGIO',
  APRENDIZ: 'APRENDIZ',
  TEMPORARIO: 'TEMPORARIO',
};

var EmployeeStatus = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
  AFASTADO: 'AFASTADO',
};

/**
 * "Tipo de movimentação" de uma linha orçamentária (budgetEntries). Uma
 * linha é (diretoria, centro de custo, cargo) + este tipo — não está mais
 * vinculada a uma matrícula/colaborador específico (ver módulo Orçamento).
 */
var PlannedSituation = {
  SEM_MOVIMENTACAO: 'SEM_MOVIMENTACAO',
  PROMOCAO: 'PROMOCAO',
  MERITO: 'MERITO',
  SUBSTITUICAO: 'SUBSTITUICAO',
  AUMENTO_DE_QUADRO: 'AUMENTO_DE_QUADRO',
  DESLIGAMENTO: 'DESLIGAMENTO',
};

/**
 * As 12 colunas mensais de uma linha de orçamento (jan..dez), na ordem em
 * que aparecem na planilha de importação e nas tabelas do sistema. Cada
 * coluna guarda o custo orçado daquele mês para a linha (diretoria +
 * centro de custo + cargo + tipo de movimentação); null/vazio = sem custo
 * orçado naquele mês (vaga ainda não aberta, já desligada, etc.).
 */
var MONTH_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

var MovementType = {
  PROMOCAO: 'PROMOCAO',
  MERITO: 'MERITO',
  AUMENTO_QUADRO: 'AUMENTO_QUADRO',
  TRANSFERENCIA: 'TRANSFERENCIA',
};

var MovementStatus = {
  RASCUNHO: 'RASCUNHO',
  PENDENTE_DIRETOR: 'PENDENTE_DIRETOR',
  PENDENTE_RH: 'PENDENTE_RH',
  PENDENTE_FINANCEIRO: 'PENDENTE_FINANCEIRO',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO',
  CANCELADO: 'CANCELADO',
};

var ApproverRole = {
  DIRETOR: 'DIRETOR',
  RH_REMUNERACAO: 'RH_REMUNERACAO',
  FINANCEIRO: 'FINANCEIRO',
};

var ApprovalStatus = {
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO',
  PULADO: 'PULADO',
};

var MarketPosition = {
  ABAIXO_DO_MERCADO: 'ABAIXO_DO_MERCADO',
  DENTRO_DO_MERCADO: 'DENTRO_DO_MERCADO',
  ACIMA_DO_MERCADO: 'ACIMA_DO_MERCADO',
};

var ChargeValueType = {
  PERCENTUAL: 'PERCENTUAL',
  FIXO: 'FIXO',
};

/** Ordem fixa do workflow de aprovação sequencial. */
var APPROVAL_WORKFLOW_ORDER = [ApproverRole.DIRETOR, ApproverRole.RH_REMUNERACAO, ApproverRole.FINANCEIRO];

/** Status da movimentação que corresponde a cada etapa pendente. */
var STATUS_FOR_APPROVER_ROLE = {};
STATUS_FOR_APPROVER_ROLE[ApproverRole.DIRETOR] = MovementStatus.PENDENTE_DIRETOR;
STATUS_FOR_APPROVER_ROLE[ApproverRole.RH_REMUNERACAO] = MovementStatus.PENDENTE_RH;
STATUS_FOR_APPROVER_ROLE[ApproverRole.FINANCEIRO] = MovementStatus.PENDENTE_FINANCEIRO;

/** Status seguinte após a aprovação de cada etapa. */
var STATUS_AFTER_STEP = {};
STATUS_AFTER_STEP[ApproverRole.DIRETOR] = MovementStatus.PENDENTE_RH;
STATUS_AFTER_STEP[ApproverRole.RH_REMUNERACAO] = MovementStatus.PENDENTE_FINANCEIRO;
STATUS_AFTER_STEP[ApproverRole.FINANCEIRO] = MovementStatus.APROVADO;

/** Perfis com escopo restrito à própria diretoria. */
var SCOPED_ROLES = [UserRole.DIRETOR, UserRole.GESTOR];

/** Parametrização de regras de negócio (equivalente a backend/.env). */
var RULES = {
  MAX_INCREASE_PERCENT_ALERT: 20,
};
