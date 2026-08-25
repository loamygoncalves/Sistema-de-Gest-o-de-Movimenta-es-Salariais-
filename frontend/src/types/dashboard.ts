export interface HeadcountDashboard {
  year: number;
  month: number;
  hcBudgeted: number;
  hcCurrent: number;
  hcApproved: number;
  hcOpen: number;
}

export interface PayrollDashboard {
  year: number;
  month: number;
  payrollCurrent: number;
  payrollBudgeted: number;
  difference: number;
}

export interface MovementsDashboard {
  promotions: number;
  merits: number;
  headcountIncrease: number;
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
