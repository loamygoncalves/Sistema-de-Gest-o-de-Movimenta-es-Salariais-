import { MovementType } from "./enums";

// GET /history rows — the contract only names the filter params; row shape
// is a judgment call combining the movement's key fields with the recorded
// financial impact used elsewhere (`movement_history.annual_impact`).
export interface MovementHistoryEntry {
  id: string;
  movementId: string;
  type: MovementType;
  employeeName?: string;
  positionName?: string;
  directorateId: string;
  directorateName: string;
  costCenterId?: string;
  costCenterName?: string;
  effectiveDate: string;
  monthlyImpact: number;
  annualImpact: number;
  approvedAt: string;
}

export interface HeadcountEvolutionPoint {
  month: string;
  hc: number;
}

export interface HistoryIndicators {
  promotionsCount: number;
  meritsCount: number;
  salaryGrowthPercent: number;
  accumulatedImpact: number;
  headcountEvolution: HeadcountEvolutionPoint[];
}

export type HistoryExportFormat = "xlsx" | "pdf";
