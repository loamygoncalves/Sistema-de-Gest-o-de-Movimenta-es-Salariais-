// Enums mirroring the backend contract (docs/API_CONTRACT.md).

export type Role = "ADMIN" | "RH_REMUNERACAO" | "DIRETOR" | "GESTOR";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  RH_REMUNERACAO: "RH Remuneração",
  DIRETOR: "Diretor",
  GESTOR: "Gestor",
};

export type MovementType = "PROMOCAO" | "MERITO" | "AUMENTO_QUADRO";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PROMOCAO: "Promoção",
  MERITO: "Mérito",
  AUMENTO_QUADRO: "Aumento de Quadro",
};

// O fluxo de aprovação agora é configurável (ver ApprovalWorkflowStep) — a
// movimentação tem um único status "em aprovação", genérico; a etapa ativa é
// derivada dinamicamente pela menor ApprovalStep.order ainda PENDENTE.
export type MovementStatus =
  | "RASCUNHO"
  | "PENDENTE_APROVACAO"
  | "APROVADO"
  | "REPROVADO"
  | "CANCELADO";

export const MOVEMENT_STATUS_LABELS: Record<MovementStatus, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Pendente de Aprovação",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  CANCELADO: "Cancelado",
};

// Approval step status — judgment call, not enumerated explicitly in the
// contract beyond the approve/reject actions.
export type ApprovalStepStatus = "PENDENTE" | "APROVADO" | "REPROVADO" | "PULADO";

export const APPROVAL_STEP_STATUS_LABELS: Record<ApprovalStepStatus, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  PULADO: "Pulada",
};

// Perfis que podem decidir uma etapa de aprovação (ver ApprovalWorkflowStep).
// GESTOR nunca aprova — só solicita.
export type ApprovalStepRole = "ADMIN" | "DIRETOR" | "RH_REMUNERACAO";

export const APPROVAL_STEP_ROLE_LABELS: Record<ApprovalStepRole, string> = {
  ADMIN: "Administrador",
  DIRETOR: "Diretor",
  RH_REMUNERACAO: "RH Remuneração",
};

// Employee status — judgment call (not detailed in the contract).
export type EmployeeStatus = "ATIVO" | "INATIVO" | "AFASTADO";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  AFASTADO: "Afastado",
};

export type MarketClassification =
  | "ABAIXO_DO_MERCADO"
  | "DENTRO_DO_MERCADO"
  | "ACIMA_DO_MERCADO";

export const MARKET_CLASSIFICATION_LABELS: Record<MarketClassification, string> = {
  ABAIXO_DO_MERCADO: "Abaixo do mercado",
  DENTRO_DO_MERCADO: "Dentro do mercado",
  ACIMA_DO_MERCADO: "Acima do mercado",
};

// Charge / benefit parameter kind — judgment call ("percentual/fixo" per the
// contract's module 4 description).
export type ChargeParameterType = "PERCENTUAL" | "FIXO";

export const CHARGE_PARAMETER_TYPE_LABELS: Record<ChargeParameterType, string> = {
  PERCENTUAL: "Percentual",
  FIXO: "Valor fixo",
};

// Whether a charge parameter represents an "encargo" (payroll charge) or a
// "benefício" (benefit) — judgment call to allow the admin screen to group
// them, since the contract only says "encargos/benefícios parametrizáveis".
export type ChargeParameterCategory = "ENCARGO" | "BENEFICIO";

export const CHARGE_PARAMETER_CATEGORY_LABELS: Record<ChargeParameterCategory, string> = {
  ENCARGO: "Encargo",
  BENEFICIO: "Benefício",
};
