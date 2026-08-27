/**
 * Enumeradores do domínio — espelham backend/src/common/enums/index.ts do
 * projeto NestJS original, mantidos como strings simples (Apps Script não
 * tem enum nativo).
 */

var UserRole = {
  ADMIN: 'ADMIN',
  RH_REMUNERACAO: 'RH_REMUNERACAO',
  DIRETOR: 'DIRETOR',
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
};

/**
 * O fluxo de aprovação agora é configurável (ver ApprovalWorkflowSteps em
 * Db.gs) — a movimentação tem um único status "em aprovação" genérico; a
 * etapa ativa é derivada dinamicamente (menor stepOrder ainda PENDENTE).
 */
var MovementStatus = {
  RASCUNHO: 'RASCUNHO',
  PENDENTE_APROVACAO: 'PENDENTE_APROVACAO',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO',
  CANCELADO: 'CANCELADO',
};

/** Perfis que podem decidir uma etapa de aprovação. GESTOR nunca aprova — só solicita. */
var ApproverRole = {
  ADMIN: 'ADMIN',
  RH_REMUNERACAO: 'RH_REMUNERACAO',
  DIRETOR: 'DIRETOR',
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

/** Fluxo de aprovação padrão usado ao inicializar a planilha (ver Setup.gs). */
var DEFAULT_APPROVAL_WORKFLOW = [
  { stepOrder: 1, roles: [ApproverRole.RH_REMUNERACAO, ApproverRole.ADMIN] },
  { stepOrder: 2, roles: [ApproverRole.DIRETOR] },
];
