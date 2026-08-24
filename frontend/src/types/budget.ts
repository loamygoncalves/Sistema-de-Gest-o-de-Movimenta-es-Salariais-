export interface BudgetEntry {
  id: string;
  year: number;
  directorateId: string;
  directorateName?: string;
  positionId?: string;
  positionName?: string;
  budgetedHeadcount: number;
  budgetedSalary: number;
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
