import { EmployeeStatus } from "./enums";
import { ImportBatch } from "./common";

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

export interface DeactivatedEmployee {
  id: string;
  registration: string;
  name: string;
}

// POST /employees/import — além do ImportBatch padrão, quando este
// fechamento avança o mês mais recente (não é uma correção de mês antigo),
// lista quem estava ATIVO no fechamento anterior e não aparece nesta
// planilha, e por isso foi automaticamente marcado INATIVO.
export interface EmployeeImportResult extends ImportBatch {
  deactivated: DeactivatedEmployee[];
}

export type EmployeeComparisonItemType = "VAGA_ABERTA" | "EXCESSO_HC";

// GET /employees/comparison?year=&month= — compares the current base against
// the budget, aggregated by cost center (diretoria + centro de custo) for
// the reference month — never by cargo, so a shortfall in one position and a
// surplus in another within the same cost center net out instead of showing
// as two separate problems. The budget isn't linked to an employee, so this
// isn't a per-matrícula match — no registration/name/currentSalary/
// plannedSalary on either the items or the summary.
export interface EmployeeComparisonItem {
  type: EmployeeComparisonItemType;
  directorate: string;
  costCenter: string;
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
  // false quando o mês pedido ainda não teve um fechamento de folha
  // importado (ver POST /employees/import) — hcCurrent/budgetSavings/
  // budgetOverrun ficam 0 nesse caso, nunca "herdam" os números de outro mês.
  monthClosed: boolean;
}
