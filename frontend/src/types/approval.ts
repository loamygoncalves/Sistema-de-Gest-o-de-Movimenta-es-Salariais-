import { ApprovalStepRole, ApprovalStepStatus } from "./enums";

export interface ApprovalStep {
  id: string;
  movementId: string;
  order: number;
  // Qualquer um destes perfis pode decidir a etapa — o que agir primeiro.
  eligibleRoles: ApprovalStepRole[];
  // Preenchido só depois de decidida: qual perfil de fato decidiu.
  decidedByRole?: ApprovalStepRole | null;
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

// Configuração do fluxo de aprovação (tela ADMIN "Fluxo de Aprovação") — uma
// sequência de etapas ordenadas; cada etapa é decidida por QUALQUER UM dos
// perfis listados, o que agir primeiro.
export interface ApprovalWorkflowStep {
  id?: string;
  stepOrder: number;
  roles: ApprovalStepRole[];
}
