import { MovementStatus, MovementType } from "./enums";
import { ApprovalStep } from "./approval";

export interface PromocaoPayload {
  type: "PROMOCAO";
  employeeId: string;
  newPositionId: string;
  newSalary: number;
  effectiveDate: string;
  justification: string;
}

export interface MeritoPayload {
  type: "MERITO";
  employeeId: string;
  // Igual à Promoção: informa-se o novo salário e o backend calcula o
  // percentual de mérito automaticamente (meritPercentage), em vez de pedir
  // o percentual antecipadamente.
  newSalary: number;
  effectiveDate: string;
  justification: string;
}

export interface AumentoQuadroPayload {
  type: "AUMENTO_QUADRO";
  positionId: string;
  quantity: number;
  plannedSalary: number;
  directorateId: string;
  costCenterId: string;
  effectiveDate: string;
  justification: string;
}

export type CreateMovementPayload =
  | PromocaoPayload
  | MeritoPayload
  | AumentoQuadroPayload;

export type UpdateMovementPayload = Partial<
  PromocaoPayload & MeritoPayload & AumentoQuadroPayload
>;

// Fields common to every movement type, as returned by GET /movements and
// GET /movements/:id. Fields beyond those in the various request bodies are
// a judgment call (denormalized display names, requester, status/timestamps)
// needed to render list/detail screens.
export interface MovementRequest {
  id: string;
  type: MovementType;
  status: MovementStatus;
  employeeId?: string;
  employeeName?: string;
  positionId?: string;
  positionName?: string;
  newPositionId?: string;
  newPositionName?: string;
  currentSalary?: number;
  newSalary?: number;
  percentage?: number;
  quantity?: number;
  plannedSalary?: number;
  directorateId?: string;
  directorateName?: string;
  costCenterId?: string;
  costCenterName?: string;
  effectiveDate: string;
  justification: string;
  requestedById?: string;
  requestedByName?: string;
  createdAt: string;
  updatedAt?: string;
  simulation?: MovementSimulation | null;
  approvalSteps?: ApprovalStep[];
}

export interface BudgetComparison {
  budgeted: number;
  current: number;
  afterApproval: number;
  difference: number;
  percentConsumed: number;
}

export interface MovementSimulation {
  monthlySalaryImpact: number;
  annualSalaryImpact: number;
  chargesTotal: number;
  benefitsTotal: number;
  totalMonthlyImpact: number;
  totalAnnualImpact: number;
  budget: BudgetComparison;
  exceedsBudget: boolean;
  alertMessage: string;
  // Mensagens da Política de Remuneração (tela ADMIN/RH_REMUNERACAO)
  // violadas por esta movimentação — nunca bloqueia, só sinaliza tanto para
  // quem simula quanto para quem vai aprovar. Vazio/ausente = aderente.
  policyViolations?: string[];
  // Optional breakdown of individual charge/benefit line items — judgment
  // call to let the UI render the "encargos (breakdown)" requested, since
  // the contract only shows the aggregated totals.
  chargesBreakdown?: { name: string; value: number }[];
  benefitsBreakdown?: { name: string; value: number }[];
}
