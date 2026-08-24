export interface HeadcountDashboard {
  hcBudgeted: number;
  hcCurrent: number;
  hcApproved: number;
  hcOpen: number;
}

export interface PayrollDashboard {
  payrollCurrent: number;
  payrollBudgeted: number;
  difference: number;
}

export interface MovementsDashboard {
  promotions: number;
  merits: number;
  headcountIncrease: number;
  transfers: number;
}

export interface ProjectionPoint {
  month: string;
  impact: number;
}

export interface DirectorateRankingItem {
  directorate: string;
  consumedPercent: number;
}

export interface FinancialDashboard {
  monthlyImpact: number;
  annualImpact: number;
  budgetConsumedPercent: number;
  projection12Months: ProjectionPoint[];
  directorateRanking: DirectorateRankingItem[];
}
