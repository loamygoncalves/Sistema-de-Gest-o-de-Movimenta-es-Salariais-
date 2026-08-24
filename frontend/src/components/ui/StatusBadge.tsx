import React from "react";
import { Badge } from "./Badge";
import {
  APPROVAL_STEP_STATUS_LABELS,
  ApprovalStepStatus,
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
  MARKET_CLASSIFICATION_LABELS,
  MarketClassification,
  MOVEMENT_STATUS_LABELS,
  MovementStatus,
} from "@/types";

const MOVEMENT_STATUS_COLOR: Record<MovementStatus, "slate" | "green" | "red" | "amber" | "blue"> = {
  RASCUNHO: "slate",
  PENDENTE_DIRETOR: "amber",
  PENDENTE_FINANCEIRO: "amber",
  PENDENTE_RH: "amber",
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
