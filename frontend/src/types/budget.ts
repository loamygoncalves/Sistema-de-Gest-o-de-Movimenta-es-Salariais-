// Budget entry: orçamento por diretoria + centro de custo + cargo + tipo de
// movimentação (matches backend/src/modules/budget/entities/budget-entry.entity.ts).
// Not linked to an employee (no matrícula/nome) — each row is one budgeted
// headcount seat of that combination, with a budgeted cost per calendar
// month. Multiple rows can share the exact same
// diretoria+centro de custo+cargo+tipo combination — that's normal (N
// identical rows = N budgeted seats of that type), not a data error.
//
// Named `BudgetMovementType`/`BUDGET_MOVEMENT_TYPE_LABELS` (rather than
// `MovementType`/`MOVEMENT_TYPE_LABELS`) to avoid colliding with the
// unrelated movement-request `MovementType` enum already exported from
// `./enums` (PROMOCAO | MERITO | TRANSFERENCIA | AUMENTO_QUADRO) — both are
// re-exported from the same `@/types` barrel.
export type BudgetMovementType =
  | "SEM_MOVIMENTACAO"
  | "PROMOCAO"
  | "MERITO"
  | "SUBSTITUICAO"
  | "AUMENTO_DE_QUADRO"
  | "DESLIGAMENTO";

export const BUDGET_MOVEMENT_TYPE_LABELS: Record<BudgetMovementType, string> = {
  SEM_MOVIMENTACAO: "Sem Movimentação",
  PROMOCAO: "Promoção",
  MERITO: "Mérito",
  SUBSTITUICAO: "Substituição",
  AUMENTO_DE_QUADRO: "Aumento de Quadro",
  DESLIGAMENTO: "Desligamento",
};

export type MonthKey =
  | "jan"
  | "fev"
  | "mar"
  | "abr"
  | "mai"
  | "jun"
  | "jul"
  | "ago"
  | "set"
  | "out"
  | "nov"
  | "dez";

export const MONTH_KEYS: MonthKey[] = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "Jan",
  fev: "Fev",
  mar: "Mar",
  abr: "Abr",
  mai: "Mai",
  jun: "Jun",
  jul: "Jul",
  ago: "Ago",
  set: "Set",
  out: "Out",
  nov: "Nov",
  dez: "Dez",
};

// Full month names, keyed by 1-12, for "mês de referência: Janeiro/2026"
// style captions next to month selectors.
export const FULL_MONTH_LABELS: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Março",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
};

export interface BudgetEntry {
  id: string;
  year: number;
  directorateId: string;
  directorateName?: string;
  costCenterId: string;
  costCenterName?: string;
  positionId: string;
  positionName?: string;
  movementType: BudgetMovementType;
  jan: number | null;
  fev: number | null;
  mar: number | null;
  abr: number | null;
  mai: number | null;
  jun: number | null;
  jul: number | null;
  ago: number | null;
  set: number | null;
  out: number | null;
  nov: number | null;
  dez: number | null;
  createdAt?: string;
}

// GET /budget/dashboard?year=&month=&directorateId=&costCenterId=
export interface BudgetDashboard {
  year: number;
  month: number;
  hcBudgeted: number;
  payrollBudgeted: number;
  annualBudgeted: number;
}
