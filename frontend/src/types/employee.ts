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

export interface EmployeeComparisonItem {
  employeeId?: string;
  directorateId: string;
  directorateName: string;
  positionId?: string;
  positionName?: string;
  budgetedHeadcount?: number;
  currentHeadcount?: number;
  description?: string;
  value?: number;
}

export interface EmployeeComparisonResponse {
  promotionsDone: number;
  promotionsPending: number;
  openPositions: number;
  headcountExcess: number;
  budgetSavings: number;
  budgetOverrun: number;
  items: EmployeeComparisonItem[];
}
