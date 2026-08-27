import React from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { MovementSimulation } from "@/types";

export function SimulationPanel({ simulation }: { simulation: MovementSimulation }) {
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
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Comparativo Orçamentário
        </p>
        <p className="mb-2 text-xs text-brand-text">
          Projeção do ano inteiro (jan-dez) para o centro de custo: acumulado real dos meses já
          fechados + o restante do ano projetado a partir do último fechamento já com esta
          movimentação, comparado ao orçamento anual.
        </p>
        <div className="overflow-x-auto rounded-lg border border-brand-border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-brand-bg">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-brand-text">Orçado (ano)</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-brand-text">Atual (acumulado)</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-brand-text">Projeção (ano)</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-brand-text">Diferença</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-brand-text">% Consumido</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-brand-border">
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
    <div className={`rounded-lg border px-4 py-3 ${highlight ? "border-brand-teal/30 bg-brand-teal/10" : "border-brand-border bg-brand-bg"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-text">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-brand-teal-dark" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function BreakdownList({ title, items }: { title: string; items: { name: string; value: number }[] }) {
  return (
    <div className="rounded-lg border border-brand-border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.name} className="flex items-center justify-between text-sm">
            <span className="text-brand-text">{item.name}</span>
            <span className="font-medium text-slate-800">{formatCurrency(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
