export enum UserRole {
  ADMIN = 'ADMIN',
  RH_REMUNERACAO = 'RH_REMUNERACAO',
  DIRETOR = 'DIRETOR',
  GESTOR = 'GESTOR',
}

export enum ContractType {
  CLT = 'CLT',
  PJ = 'PJ',
  ESTAGIO = 'ESTAGIO',
  APRENDIZ = 'APRENDIZ',
  TEMPORARIO = 'TEMPORARIO',
}

export enum EmployeeStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  AFASTADO = 'AFASTADO',
}

/**
 * "Tipo de movimentação" de uma linha orçamentária (budget_entries). Uma
 * linha é (diretoria, centro de custo, cargo) + este tipo — não está mais
 * vinculada a uma matrícula/colaborador específico (ver módulo Orçamento).
 */
export enum PlannedSituation {
  SEM_MOVIMENTACAO = 'SEM_MOVIMENTACAO',
  PROMOCAO = 'PROMOCAO',
  MERITO = 'MERITO',
  SUBSTITUICAO = 'SUBSTITUICAO',
  AUMENTO_DE_QUADRO = 'AUMENTO_DE_QUADRO',
  DESLIGAMENTO = 'DESLIGAMENTO',
}

/**
 * As 12 colunas mensais de uma linha de orçamento (jan..dez), na ordem em
 * que aparecem na planilha de importação e nas tabelas do sistema. Cada
 * coluna guarda o custo orçado daquele mês para a linha (diretoria +
 * centro de custo + cargo + tipo de movimentação); null/vazio = sem custo
 * orçado naquele mês (vaga ainda não aberta, já desligada, etc.).
 */
export const MONTH_KEYS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

export enum MovementType {
  PROMOCAO = 'PROMOCAO',
  MERITO = 'MERITO',
  AUMENTO_QUADRO = 'AUMENTO_QUADRO',
}

/**
 * PENDENTE_APROVACAO cobre qualquer etapa do fluxo configurável — qual
 * etapa está ativa agora não é mais lido do status da movimentação, e sim
 * de `approval_steps` (a de menor `stepOrder` ainda `PENDENTE`; ver
 * ApprovalsService).
 */
export enum MovementStatus {
  RASCUNHO = 'RASCUNHO',
  PENDENTE_APROVACAO = 'PENDENTE_APROVACAO',
  APROVADO = 'APROVADO',
  /** Encerrado — histórico apenas: nenhum código novo produz esse status, ver DEVOLVIDO. */
  REPROVADO = 'REPROVADO',
  /** Recusado por um aprovador, mas volta para quem solicitou (com o motivo) em vez de encerrar — pode editar e reenviar (ApprovalsService#reject / MovementsService#submit). */
  DEVOLVIDO = 'DEVOLVIDO',
  CANCELADO = 'CANCELADO',
}

/**
 * Perfis que podem aparecer numa etapa do fluxo de aprovação (ver
 * ApprovalWorkflowStep). GESTOR nunca aprova — só solicita.
 */
export enum ApproverRole {
  ADMIN = 'ADMIN',
  RH_REMUNERACAO = 'RH_REMUNERACAO',
  DIRETOR = 'DIRETOR',
}

export enum ApprovalStatus {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO',
  PULADO = 'PULADO',
}

export enum ImportType {
  ORCAMENTO = 'ORCAMENTO',
  BASE_COLABORADORES = 'BASE_COLABORADORES',
  ESTUDO_SALARIAL = 'ESTUDO_SALARIAL',
  CENTRO_CUSTO = 'CENTRO_CUSTO',
}

export enum ImportStatus {
  PROCESSANDO = 'PROCESSANDO',
  CONCLUIDO = 'CONCLUIDO',
  CONCLUIDO_COM_ERROS = 'CONCLUIDO_COM_ERROS',
  FALHOU = 'FALHOU',
}

export enum MarketPosition {
  ABAIXO_DO_MERCADO = 'ABAIXO_DO_MERCADO',
  DENTRO_DO_MERCADO = 'DENTRO_DO_MERCADO',
  ACIMA_DO_MERCADO = 'ACIMA_DO_MERCADO',
}

export enum ChargeValueType {
  PERCENTUAL = 'PERCENTUAL',
  FIXO = 'FIXO',
}

