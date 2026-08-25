export interface HeadcountByMonth {
  month: number;
  hcBudgeted: number;
  hcCurrent: number;
  hcOpen: number;
  monthClosed: boolean;
}

export interface HeadcountDashboard {
  year: number;
  months: number[];
  // hcBudgeted/hcCurrent/hcOpen são a média entre os meses selecionados
  // (headcount não é aditivo — não faz sentido "somar pessoas" entre meses).
  hcBudgeted: number;
  hcCurrent: number;
  hcApproved: number;
  hcOpen: number;
  // false quando algum dos meses selecionados ainda não teve fechamento de
  // folha importado (ver POST /employees/import) — esses meses entram
  // zerados na média, nunca "herdam" o HC de outro mês fechado.
  monthClosed: boolean;
  openMonths: number[];
  byMonth: HeadcountByMonth[];
}

export interface PayrollByMonth {
  month: number;
  payrollBudgeted: number;
  payrollCurrent: number;
  monthClosed: boolean;
}

export interface PayrollDashboard {
  year: number;
  months: number[];
  // payrollCurrent/payrollBudgeted são a SOMA entre os meses selecionados —
  // gasto acumulado do período (folha é aditiva, diferente de headcount).
  payrollCurrent: number;
  payrollBudgeted: number;
  difference: number;
  // false quando algum dos meses selecionados ainda não teve fechamento de
  // folha importado — esse mês entra zerado na soma.
  monthClosed: boolean;
  openMonths: number[];
  byMonth: PayrollByMonth[];
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
  months: number[];
  monthlyImpact: number;
  annualImpact: number;
  budgetConsumedPercent: number;
  projection12Months: ProjectionPoint[];
  directorateRanking: DirectorateRankingItem[];
  monthClosed: boolean;
  openMonths: number[];
}

export interface CostCenterBreakdownItem {
  directorateId: string;
  directorateName?: string;
  costCenterId: string;
  costCenterName?: string;
  // Custo somado entre os meses selecionados (gasto acumulado do período).
  budgetedCost: number;
  currentCost: number;
  difference: number;
  // Headcount médio entre os meses selecionados.
  budgetedCount: number;
  currentCount: number;
  status: "DENTRO" | "ACIMA";
}

export interface CostCenterBreakdownDashboard {
  year: number;
  months: number[];
  items: CostCenterBreakdownItem[];
}
