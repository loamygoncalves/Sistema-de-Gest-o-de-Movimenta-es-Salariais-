import { MarketClassification } from "./enums";

export interface SalaryStudy {
  id: string;
  name: string;
  source: string;
  referenceYear: number;
  importedAt?: string;
  entriesCount?: number;
}

export interface SalaryStudyEntry {
  id: string;
  studyId: string;
  positionId: string;
  positionName?: string;
  marketP25?: number;
  marketP50: number;
  marketP75?: number;
  marketP90: number;
}

export interface ImportSalaryStudyMeta {
  name: string;
  source: string;
  referenceYear: number;
}

export interface SalaryPositioningItem {
  employee: {
    id: string;
    name: string;
    positionId?: string;
    positionName?: string;
    directorateId?: string;
    directorateName?: string;
  };
  currentSalary: number;
  marketP50: number;
  marketP90: number;
  classification: MarketClassification;
}
