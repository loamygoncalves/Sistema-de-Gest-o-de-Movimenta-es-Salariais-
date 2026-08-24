import { ApprovalStepRole, ApprovalStepStatus } from "./enums";

export interface ApprovalStep {
  id: string;
  movementId: string;
  order: number;
  role: ApprovalStepRole;
  status: ApprovalStepStatus;
  approverId?: string | null;
  approverName?: string | null;
  comment?: string | null;
  decidedAt?: string | null;
  createdAt?: string;
}

// Denormalized view of a pending approval for the "Minhas pendências" list —
// judgment call to include the parent movement's key display fields so the
// table doesn't require a second round-trip per row.
export interface PendingApproval extends ApprovalStep {
  movementType: string;
  employeeName?: string;
  directorateName?: string;
  effectiveDate?: string;
  totalAnnualImpact?: number;
}

export interface ApprovalActionPayload {
  comment?: string;
}
