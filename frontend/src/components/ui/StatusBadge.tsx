import React from "react";
import { Badge } from "./Badge";
import {
  APPROVAL_STEP_STATUS_LABELS,
  ApprovalStepStatus,
  BUDGET_MOVEMENT_TYPE_LABELS,
  BudgetMovementType,
  EMPLOYEE_STATUS_LABELS,
  EmployeeComparisonItemType,
  EmployeeStatus,
  MARKET_CLASSIFICATION_LABELS,
  MarketClassification,
  MOVEMENT_STATUS_LABELS,
  MovementStatus,
} from "@/types";

const MOVEMENT_STATUS_COLOR: Record<MovementStatus, "slate" | "green" | "red" | "amber" | "blue"> = {
  RASCUNHO: "slate",
  PENDENTE_APROVACAO: "amber",
  APROVADO: "green",
  REPROVADO: "red",
  CANCELADO: "slate",
};

export function MovementStatusBadge({ status }: { status: MovementStatus }) {
  return <Badge color={MOVEMENT_STATUS_COLOR[status] ?? "slate"}>{MOVEMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

const APPROVAL_STATUS_COLOR: Record<ApprovalStepStatus, "slate" | "green" | "red" | "amber"> = {
  PENDENTE: "amber",
  APROVADO: "green",
  REPROVADO: "red",
  PULADO: "slate",
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStepStatus }) {
  return <Badge color={APPROVAL_STATUS_COLOR[status] ?? "slate"}>{APPROVAL_STEP_STATUS_LABELS[status] ?? status}</Badge>;
}

const MARKET_CLASSIFICATION_COLOR: Record<MarketClassification, "green" | "red" | "amber"> = {
  ABAIXO_DO_MERCADO: "amber",
  DENTRO_DO_MERCADO: "green",
  ACIMA_DO_MERCADO: "red",
};

export function MarketClassificationBadge({ classification }: { classification: MarketClassification }) {
  return (
    <Badge color={MARKET_CLASSIFICATION_COLOR[classification] ?? "slate"}>
      {MARKET_CLASSIFICATION_LABELS[classification] ?? classification}
    </Badge>
  );
}

const EMPLOYEE_STATUS_COLOR: Record<EmployeeStatus, "green" | "slate" | "amber"> = {
  ATIVO: "green",
  INATIVO: "slate",
  AFASTADO: "amber",
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge color={EMPLOYEE_STATUS_COLOR[status] ?? "slate"}>{EMPLOYEE_STATUS_LABELS[status] ?? status}</Badge>;
}

const BUDGET_MOVEMENT_TYPE_COLOR: Record<BudgetMovementType, "slate" | "green" | "red" | "amber" | "blue" | "teal"> = {
  SEM_MOVIMENTACAO: "slate",
  PROMOCAO: "teal",
  MERITO: "blue",
  SUBSTITUICAO: "amber",
  AUMENTO_DE_QUADRO: "green",
  DESLIGAMENTO: "red",
};

export function BudgetMovementTypeBadge({ type }: { type: BudgetMovementType }) {
  return (
    <Badge color={BUDGET_MOVEMENT_TYPE_COLOR[type] ?? "slate"}>{BUDGET_MOVEMENT_TYPE_LABELS[type] ?? type}</Badge>
  );
}

const COMPARISON_ITEM_TYPE_COLOR: Record<EmployeeComparisonItemType, "green" | "amber"> = {
  VAGA_ABERTA: "green",
  EXCESSO_HC: "amber",
};

const COMPARISON_ITEM_TYPE_LABELS: Record<EmployeeComparisonItemType, string> = {
  VAGA_ABERTA: "Vaga Aberta",
  EXCESSO_HC: "Excesso de HC",
};

export function ComparisonItemTypeBadge({ type }: { type: EmployeeComparisonItemType }) {
  return (
    <Badge color={COMPARISON_ITEM_TYPE_COLOR[type] ?? "slate"}>{COMPARISON_ITEM_TYPE_LABELS[type] ?? type}</Badge>
  );
}
