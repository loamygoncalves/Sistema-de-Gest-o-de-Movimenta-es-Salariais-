"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/Spinner";
import { MovementStatusBadge, ApprovalStatusBadge } from "@/components/ui/StatusBadge";
import { SimulationPanel } from "@/components/shared/SimulationPanel";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatPercent, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { normalizeSimulation } from "@/lib/normalize";
import {
  APPROVAL_STEP_ROLE_LABELS,
  ApprovalStep,
  MOVEMENT_TYPE_LABELS,
  MovementRequest,
  MovementSimulation,
} from "@/types";

export default function MovementDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [movement, setMovement] = useState<MovementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulation, setSimulation] = useState<MovementSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);

  const loadMovement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MovementRequest>(`/movements/${params.id}`);
      setMovement(res);
      setSimulation(res.simulation ? normalizeSimulation(res.simulation) : null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const loadSteps = useCallback(async () => {
    setLoadingSteps(true);
    try {
      const res = await api.get<ApprovalStep[]>(`/approvals/movement/${params.id}`);
      setSteps(res ?? []);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoadingSteps(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    loadMovement();
    loadSteps();
  }, [loadMovement, loadSteps]);

  async function handleSimulate() {
    setSimulating(true);
    try {
      const res = await api.post<MovementSimulation>(`/movements/${params.id}/simulate`);
      setSimulation(normalizeSimulation(res));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSimulating(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/movements/${params.id}/submit`);
      showToast("Movimentação submetida para aprovação.", "success");
      await loadMovement();
      await loadSteps();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!movement) return <p className="text-sm text-brand-text">Movimentação não encontrada.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="mb-1 text-xs text-slate-400 hover:text-brand-text">
            ← Voltar
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
            </h1>
            <MovementStatusBadge status={movement.status} />
          </div>
          <p className="text-sm text-brand-text">{movement.employeeName ?? "Aumento de quadro / vaga"}</p>
        </div>
        {movement.status === "RASCUNHO" && (
          <Button onClick={handleSubmit} loading={submitting}>
            Submeter para aprovação
          </Button>
        )}
      </div>

      <Card title="Dados da movimentação">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Colaborador" value={movement.employeeName} />
          <Field label="Cargo atual" value={movement.positionName} />
          <Field label="Novo cargo" value={movement.newPositionName} />
          <Field label="Salário atual" value={movement.currentSalary != null ? formatCurrency(movement.currentSalary) : undefined} />
          <Field label="Novo salário" value={movement.newSalary != null ? formatCurrency(movement.newSalary) : undefined} />
          <Field label="Percentual" value={movement.percentage != null ? formatPercent(movement.percentage) : undefined} />
          <Field label="Quantidade" value={movement.quantity?.toString()} />
          <Field label="Salário planejado" value={movement.plannedSalary != null ? formatCurrency(movement.plannedSalary) : undefined} />
          <Field label="Diretoria" value={movement.directorateName} />
          <Field label="Centro de custo" value={movement.costCenterName} />
          <Field label="Data efetiva" value={formatDate(movement.effectiveDate)} />
          <Field label="Solicitado por" value={movement.requestedByName} />
          <Field label="Criado em" value={formatDateTime(movement.createdAt)} />
        </dl>
        <div className="mt-4 border-t border-brand-border pt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Justificativa</p>
          <p className="text-sm text-brand-text">{movement.justification}</p>
        </div>
      </Card>

      <Card
        title="Simulador de Impacto"
        subtitle="Impacto financeiro projetado para esta movimentação."
        actions={
          <Button size="sm" variant="outline" onClick={handleSimulate} loading={simulating}>
            {simulation ? "Recalcular" : "Executar simulação"}
          </Button>
        }
      >
        {simulation ? <SimulationPanel simulation={simulation} /> : (
          <p className="text-sm text-brand-text">Nenhuma simulação executada ainda. Clique em &quot;Executar simulação&quot;.</p>
        )}
      </Card>

      <Card title="Linha do tempo de aprovação">
        <ApprovalTimeline steps={steps} loading={loadingSteps} />
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

function ApprovalTimeline({ steps, loading }: { steps: ApprovalStep[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;
  if (steps.length === 0) return <p className="text-sm text-brand-text">Nenhuma etapa de aprovação registrada ainda.</p>;

  const ordered = [...steps].sort((a, b) => a.order - b.order);

  return (
    <ol className="flex flex-col gap-4">
      {ordered.map((step, idx) => (
        <li key={step.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.status === "APROVADO"
                  ? "bg-emerald-100 text-emerald-700"
                  : step.status === "REPROVADO"
                  ? "bg-red-100 text-red-700"
                  : "bg-brand-bg text-brand-text"
              }`}
            >
              {idx + 1}
            </span>
            {idx < ordered.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-brand-border" />}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {step.decidedByRole
                  ? APPROVAL_STEP_ROLE_LABELS[step.decidedByRole] ?? step.decidedByRole
                  : step.eligibleRoles.map((role) => APPROVAL_STEP_ROLE_LABELS[role] ?? role).join(" ou ")}
              </span>
              <ApprovalStatusBadge status={step.status} />
            </div>
            {step.approverName && <p className="text-xs text-brand-text">Aprovador: {step.approverName}</p>}
            {step.comment && <p className="mt-1 text-sm text-brand-text">&quot;{step.comment}&quot;</p>}
            {step.decidedAt && <p className="text-xs text-slate-400">{formatDateTime(step.decidedAt)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
