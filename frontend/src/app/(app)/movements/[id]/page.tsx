"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/Spinner";
import { MovementStatusBadge, ApprovalStatusBadge } from "@/components/ui/StatusBadge";
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
  if (!movement) return <p className="text-sm text-slate-500">Movimentação não encontrada.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="mb-1 text-xs text-slate-400 hover:text-slate-600">
            ← Voltar
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
            </h1>
            <MovementStatusBadge status={movement.status} />
          </div>
          <p className="text-sm text-slate-500">{movement.employeeName ?? "Aumento de quadro / vaga"}</p>
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
          <Field label="Diretoria de origem" value={movement.originDirectorateName} />
          <Field label="Diretoria de destino" value={movement.destinationDirectorateName} />
          <Field label="Data efetiva" value={formatDate(movement.effectiveDate)} />
          <Field label="Solicitado por" value={movement.requestedByName} />
          <Field label="Criado em" value={formatDateTime(movement.createdAt)} />
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Justificativa</p>
          <p className="text-sm text-slate-700">{movement.justification}</p>
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
          <p className="text-sm text-slate-500">Nenhuma simulação executada ainda. Clique em &quot;Executar simulação&quot;.</p>
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

function SimulationPanel({ simulation }: { simulation: MovementSimulation }) {
  const {
    monthlySalaryImpact,
    annualSalaryImpact,
    chargesTotal,
    benefitsTotal,
    totalMonthlyImpact,
    totalAnnualImpact,
    budget,
    exceedsBudget,
    alertMessage,
    chargesBreakdown,
    benefitsBreakdown,
  } = simulation;

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          exceedsBudget
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {alertMessage}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile label="Impacto Salarial Mensal" value={formatCurrency(monthlySalaryImpact)} />
        <MetricTile label="Impacto Salarial Anual" value={formatCurrency(annualSalaryImpact)} />
        <MetricTile label="Total de Encargos" value={formatCurrency(chargesTotal)} />
        <MetricTile label="Total de Benefícios" value={formatCurrency(benefitsTotal)} />
        <MetricTile label="Impacto Total Mensal" value={formatCurrency(totalMonthlyImpact)} highlight />
        <MetricTile label="Impacto Total Anual" value={formatCurrency(totalAnnualImpact)} highlight />
      </div>

      {(chargesBreakdown?.length || benefitsBreakdown?.length) ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {chargesBreakdown && chargesBreakdown.length > 0 && (
            <BreakdownList title="Encargos" items={chargesBreakdown} />
          )}
          {benefitsBreakdown && benefitsBreakdown.length > 0 && (
            <BreakdownList title="Benefícios" items={benefitsBreakdown} />
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Comparativo Orçamentário
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Orçado</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Atual</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Após Aprovação</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Diferença</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">% Consumido</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2.5">{formatCurrency(budget.budgeted)}</td>
                <td className="px-4 py-2.5">{formatCurrency(budget.current)}</td>
                <td className="px-4 py-2.5">{formatCurrency(budget.afterApproval)}</td>
                <td className={`px-4 py-2.5 ${budget.difference < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(budget.difference)}
                </td>
                <td className={`px-4 py-2.5 font-medium ${budget.percentConsumed > 100 ? "text-red-600" : "text-slate-800"}`}>
                  {formatPercent(budget.percentConsumed)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${highlight ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-brand-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function BreakdownList({ title, items }: { title: string; items: { name: string; value: number }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.name} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{item.name}</span>
            <span className="font-medium text-slate-800">{formatCurrency(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApprovalTimeline({ steps, loading }: { steps: ApprovalStep[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;
  if (steps.length === 0) return <p className="text-sm text-slate-500">Nenhuma etapa de aprovação registrada ainda.</p>;

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
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {idx + 1}
            </span>
            {idx < ordered.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-slate-200" />}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {APPROVAL_STEP_ROLE_LABELS[step.role] ?? step.role}
              </span>
              <ApprovalStatusBadge status={step.status} />
            </div>
            {step.approverName && <p className="text-xs text-slate-500">Aprovador: {step.approverName}</p>}
            {step.comment && <p className="mt-1 text-sm text-slate-600">&quot;{step.comment}&quot;</p>}
            {step.decidedAt && <p className="text-xs text-slate-400">{formatDateTime(step.decidedAt)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
