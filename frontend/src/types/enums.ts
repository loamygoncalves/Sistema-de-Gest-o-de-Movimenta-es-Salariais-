// Enums mirroring the backend contract (docs/API_CONTRACT.md).

export type Role =
  | "ADMIN"
  | "RH_REMUNERACAO"
  | "DIRETOR"
  | "FINANCEIRO"
  | "GESTOR";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  RH_REMUNERACAO: "RH Remuneração",
  DIRETOR: "Diretor",
  FINANCEIRO: "Financeiro",
  GESTOR: "Gestor",
};

export type MovementType = "PROMOCAO" | "MERITO" | "AUMENTO_QUADRO";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PROMOCAO: "Promoção",
  MERITO: "Mérito",
  AUMENTO_QUADRO: "Aumento de Quadro",
};

// The contract only explicitly names RASCUNHO and PENDENTE_DIRETOR as
// movement statuses. The remaining statuses below are a judgment call to
// model a realistic multi-step approval workflow (director -> financeiro ->
// RH remuneração) consistent with the ApprovalStep roles used elsewhere in
// the contract. Adjust here if the backend exposes a different status set.
export type MovementStatus =
  | "RASCUNHO"
  | "PENDENTE_DIRETOR"
  | "PENDENTE_FINANCEIRO"
  | "PENDENTE_RH"
  | "APROVADO"
  | "REPROVADO"
  | "CANCELADO";

export const MOVEMENT_STATUS_LABELS: Record<MovementStatus, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_DIRETOR: "Pendente Diretor",
  PENDENTE_FINANCEIRO: "Pendente Financeiro",
  PENDENTE_RH: "Pendente RH",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  CANCELADO: "Cancelado",
};

// Approval step status — judgment call, not enumerated explicitly in the
// contract beyond the approve/reject actions.
export type ApprovalStepStatus = "PENDENTE" | "APROVADO" | "REPROVADO";

export const APPROVAL_STEP_STATUS_LABELS: Record<ApprovalStepStatus, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

// Role responsible for a given approval step. Judgment call based on the
// roles named in the contract (`DIRETOR só vê steps DIRETOR da própria
// diretoria etc.`).
export type ApprovalStepRole = "DIRETOR" | "FINANCEIRO" | "RH_REMUNERACAO";

export const APPROVAL_STEP_ROLE_LABELS: Record<ApprovalStepRole, string> = {
  DIRETOR: "Diretor",
  FINANCEIRO: "Financeiro",
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
