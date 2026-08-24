// One row per planned employee/vacancy for a given year (matches
// backend/src/modules/budget/entities/budget-entry.entity.ts) — not an
// aggregate per diretoria/cargo.
export type PlannedSituation =
  | "SEM_MOVIMENTACAO"
  | "PROMOCAO"
  | "MERITO"
  | "TRANSFERENCIA"
  | "NOVA_VAGA";

export const PLANNED_SITUATION_LABELS: Record<PlannedSituation, string> = {
  SEM_MOVIMENTACAO: "Sem movimentação",
  PROMOCAO: "Promoção",
  MERITO: "Mérito",
  TRANSFERENCIA: "Transferência",
  NOVA_VAGA: "Nova vaga",
};

export interface BudgetEntry {
  id: string;
  year: number;
  registration?: string;
  name?: string;
  employeeId?: string;
  directorateId: string;
  directorateName?: string;
  positionId?: string;
  positionName?: string;
  currentSalary: number;
  plannedSituation: PlannedSituation;
  plannedSalary: number;
  plannedMonth?: number;
  monthlyBudgetedCost: number;
  annualBudgetedCost: number;
  createdAt?: string;
}

export interface BudgetDashboard {
  hcBudgeted: number;
  hcCurrent: number;
  hcDifference: number;
  payrollBudgeted: number;
  payrollCurrent: number;
  financialDeviation: number;
  budgetConsumedPercent: number;
}
