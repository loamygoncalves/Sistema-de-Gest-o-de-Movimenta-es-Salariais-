import { EmployeeStatus } from "./enums";

// Employee fields beyond the filters/comparison payload explicitly named in
// the contract (`GET /employees?directorateId=&positionId=&status=&search=`)
// are a judgment call for a typical HR "base atual" record.
export interface Employee {
  id: string;
  name: string;
  registration?: string;
  email?: string;
  positionId: string;
  positionName?: string;
  directorateId: string;
  directorateName?: string;
  managementId?: string;
  managementName?: string;
  costCenterId?: string;
  costCenterName?: string;
  currentSalary: number;
  admissionDate?: string;
  status: EmployeeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateEmployeePayload {
  name?: string;
  email?: string;
  positionId?: string;
  directorateId?: string;
  managementId?: string;
  costCenterId?: string;
  currentSalary?: number;
  status?: EmployeeStatus;
}

export type EmployeeComparisonItemType = "VAGA_ABERTA" | "EXCESSO_HC";

// GET /employees/comparison?year=&month= — compares the current base against
// the budget, aggregated by bucket (diretoria + centro de custo + cargo) for
// the reference month. The budget isn't linked to an employee, so this isn't
// a per-matrícula match — no registration/name/currentSalary/plannedSalary
// on either the items or the summary.
export interface EmployeeComparisonItem {
  type: EmployeeComparisonItemType;
  directorate: string;
  costCenter: string;
  position: string;
  budgetedCount: number;
  currentCount: number;
  budgetedCost: number;
  currentCost: number;
}

export type BudgetMovementsBreakdown = Record<
  "SEM_MOVIMENTACAO" | "PROMOCAO" | "MERITO" | "SUBSTITUICAO" | "AUMENTO_DE_QUADRO" | "DESLIGAMENTO",
  number
>;

export interface EmployeeComparisonResponse {
  year: number;
  month: number;
  hcBudgeted: number;
  hcCurrent: number;
  openPositions: number;
  headcountExcess: number;
  budgetSavings: number;
  budgetOverrun: number;
  movementsByType: BudgetMovementsBreakdown;
  items: EmployeeComparisonItem[];
}
