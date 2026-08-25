export interface HeadcountDashboard {
  year: number;
  month: number;
  hcBudgeted: number;
  hcCurrent: number;
  hcApproved: number;
  hcOpen: number;
  // false quando o mês pedido ainda não teve um fechamento de folha
  // importado (ver POST /employees/import) — hcCurrent fica 0 nesse caso,
  // nunca "herda" o salário/HC do último mês fechado.
  monthClosed: boolean;
}

export interface PayrollDashboard {
  year: number;
  month: number;
  payrollCurrent: number;
  payrollBudgeted: number;
  difference: number;
  // false quando o mês pedido ainda não teve um fechamento de folha
  // importado — payrollCurrent fica 0 nesse caso.
  monthClosed: boolean;
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
  monthClosed: boolean;
}
