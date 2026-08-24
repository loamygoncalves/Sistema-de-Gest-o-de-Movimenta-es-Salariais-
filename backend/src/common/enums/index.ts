export enum UserRole {
  ADMIN = 'ADMIN',
  RH_REMUNERACAO = 'RH_REMUNERACAO',
  DIRETOR = 'DIRETOR',
  FINANCEIRO = 'FINANCEIRO',
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

export enum PlannedSituation {
  SEM_MOVIMENTACAO = 'SEM_MOVIMENTACAO',
  PROMOCAO = 'PROMOCAO',
  MERITO = 'MERITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  NOVA_VAGA = 'NOVA_VAGA',
}

export enum MovementType {
  PROMOCAO = 'PROMOCAO',
  MERITO = 'MERITO',
  AUMENTO_QUADRO = 'AUMENTO_QUADRO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum MovementStatus {
  RASCUNHO = 'RASCUNHO',
  PENDENTE_DIRETOR = 'PENDENTE_DIRETOR',
  PENDENTE_RH = 'PENDENTE_RH',
  PENDENTE_FINANCEIRO = 'PENDENTE_FINANCEIRO',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO',
  CANCELADO = 'CANCELADO',
}

export enum ApproverRole {
  DIRETOR = 'DIRETOR',
  RH_REMUNERACAO = 'RH_REMUNERACAO',
  FINANCEIRO = 'FINANCEIRO',
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

/** Mapeia MovementStatus -> ApproverRole responsável pela etapa pendente atual. */
export const STATUS_TO_APPROVER_ROLE: Partial<Record<MovementStatus, ApproverRole>> = {
  [MovementStatus.PENDENTE_DIRETOR]: ApproverRole.DIRETOR,
  [MovementStatus.PENDENTE_RH]: ApproverRole.RH_REMUNERACAO,
  [MovementStatus.PENDENTE_FINANCEIRO]: ApproverRole.FINANCEIRO,
};

export const APPROVAL_WORKFLOW_ORDER: ApproverRole[] = [
  ApproverRole.DIRETOR,
  ApproverRole.RH_REMUNERACAO,
  ApproverRole.FINANCEIRO,
];
