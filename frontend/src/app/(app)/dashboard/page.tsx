"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageLoading } from "@/components/ui/Spinner";
import { DirectorateSelect, MonthMultiSelect, YearSelect } from "@/components/shared/Filters";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatNumber, formatPercent, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  CostCenterBreakdownDashboard,
  FinancialDashboard,
  FULL_MONTH_LABELS,
  HeadcountDashboard,
  MovementsDashboard,
  PayrollDashboard,
} from "@/types";

/** Diferença de HC (atual − orçado) com sinal explícito — negativo (abaixo do orçado) é OK, positivo não é. */
function formatHcDiff(diff: number): string {
  return (diff > 0 ? "+" : "") + formatNumber(diff);
}

export default function DashboardPage() {
  const { directorates } = useDirectorates();
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [directorateId, setDirectorateId] = useState("");
  const [loading, setLoading] = useState(true);

  const [headcount, setHeadcount] = useState<HeadcountDashboard | null>(null);
  const [payroll, setPayroll] = useState<PayrollDashboard | null>(null);
  const [movements, setMovements] = useState<MovementsDashboard | null>(null);
  const [financial, setFinancial] = useState<FinancialDashboard | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenterBreakdownDashboard | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = { year, months, directorateId: directorateId || undefined };

    Promise.all([
      api.get<HeadcountDashboard>("/dashboard/headcount", params),
      api.get<PayrollDashboard>("/dashboard/payroll", params),
      api.get<MovementsDashboard>("/dashboard/movements", { year, directorateId: directorateId || undefined }),
      api.get<FinancialDashboard>("/dashboard/financial", params),
      api.get<CostCenterBreakdownDashboard>("/dashboard/cost-centers", params),
    ])
      .then(([hc, pay, mov, fin, cc]) => {
        if (!active) return;
        setHeadcount(hc);
        setPayroll(pay);
        setMovements(mov);
        setFinancial(fin);
        setCostCenters(cc);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, months, directorateId]);

  const periodLabel = useMemo(() => {
    const selected = headcount?.months ?? months;
    if (selected.length === 12) return `Ano todo/${year}`;
    if (selected.length === 1) return `${FULL_MONTH_LABELS[selected[0]]}/${year}`;
    return `${selected.length} meses selecionados/${year}`;
  }, [headcount?.months, months, year]);

  const isMultiMonth = (headcount?.months ?? months).length > 1;
  const openMonths = headcount?.openMonths ?? [];
  const hcDiff = (headcount?.hcCurrent ?? 0) - (headcount?.hcBudgeted ?? 0);

  const costCenterChartData = useMemo(
    () =>
      (costCenters?.items ?? []).map((item) => ({
        name: item.costCenterName ?? "—",
        directorate: item.directorateName,
        Orçado: item.budgetedCost,
        Atual: item.currentCost,
        status: item.status,
      })),
    [costCenters],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard Executivo</h1>
          <p className="text-sm text-brand-text">Visão consolidada de headcount, folha, movimentações e orçamento.</p>
        </div>
        <div className="flex gap-3">
          <YearSelect value={year} onChange={setYear} />
          <MonthMultiSelect value={months} onChange={setMonths} />
          <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        </div>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <>
          {openMonths.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              O fechamento da folha de {openMonths.map((m) => FULL_MONTH_LABELS[m]).join(", ")} ainda não foi
              importado — esses meses entram zerados no período selecionado (não mostram o salário de outro mês).
            </div>
          )}

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Headcount</h2>
              <span className="text-xs text-brand-text">
                Período: {periodLabel}
                {isMultiMonth && " (média entre os meses)"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="HC Orçado" value={formatNumber(headcount?.hcBudgeted)} hint={periodLabel} />
              <KpiCard label="HC Atual" value={formatNumber(headcount?.hcCurrent)} />
              <KpiCard
                label="Diferença de HC (Atual − Orçado)"
                value={formatHcDiff(hcDiff)}
                tone={hcDiff > 0 ? "danger" : "success"}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Folha de Pagamento</h2>
              <span className="text-xs text-brand-text">
                Período: {periodLabel}
                {isMultiMonth && " (acumulado dos meses)"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Folha Atual" value={formatCurrency(payroll?.payrollCurrent)} />
              <KpiCard label="Folha Orçada" value={formatCurrency(payroll?.payrollBudgeted)} hint={periodLabel} />
              <KpiCard
                label="Diferença"
                value={formatCurrency(payroll?.difference)}
                tone={(payroll?.difference ?? 0) > 0 ? "danger" : "success"}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Movimentações</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Promoções" value={formatNumber(movements?.promotions)} />
              <KpiCard label="Méritos" value={formatNumber(movements?.merits)} />
              <KpiCard label="Aumento de Quadro" value={formatNumber(movements?.headcountIncrease)} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Financeiro</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Impacto Mensal" value={formatCurrency(financial?.monthlyImpact)} />
              <KpiCard label="Impacto Anual" value={formatCurrency(financial?.annualImpact)} />
              <KpiCard
                label="% Orçamento Consumido"
                value={formatPercent(financial?.budgetConsumedPercent)}
                tone={(financial?.budgetConsumedPercent ?? 0) > 100 ? "danger" : "default"}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Orçado x Atual por Centro de Custo
              </h2>
              <span className="text-xs text-brand-text">
                {directorateId
                  ? "Filtrado pela diretoria selecionada"
                  : "Todas as diretorias — selecione uma no filtro acima para focar em uma diretoria"}
              </span>
            </div>
            <Card>
              {costCenterChartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-brand-text">
                  Nenhum centro de custo com orçado ou folha fechada no período selecionado.
                </p>
              ) : (
                <>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costCenterChartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={70} />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(v)} width={90} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="Orçado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Atual" radius={[4, 4, 0, 0]}>
                          {costCenterChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.status === "ACIMA" ? "#dc2626" : "#00AFAA"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-slate-400">
                          <th className="py-2 pr-4">Diretoria</th>
                          <th className="py-2 pr-4">Centro de Custo</th>
                          <th className="py-2 pr-4 text-right">HC Orçado</th>
                          <th className="py-2 pr-4 text-right">HC Atual</th>
                          <th className="py-2 pr-4 text-right">Custo Orçado</th>
                          <th className="py-2 pr-4 text-right">Custo Atual</th>
                          <th className="py-2 pr-4 text-right">Diferença</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(costCenters?.items ?? []).map((item) => (
                          <tr key={`${item.directorateId}-${item.costCenterId}`} className="border-b border-brand-border/60">
                            <td className="py-2 pr-4 text-brand-text">{item.directorateName ?? "—"}</td>
                            <td className="py-2 pr-4 font-medium text-slate-800">{item.costCenterName ?? "—"}</td>
                            <td className="py-2 pr-4 text-right">{formatNumber(item.budgetedCount)}</td>
                            <td className="py-2 pr-4 text-right">{formatNumber(item.currentCount)}</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(item.budgetedCost)}</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(item.currentCost)}</td>
                            <td
                              className={`py-2 pr-4 text-right font-medium ${item.difference > 0 ? "text-red-600" : "text-emerald-600"}`}
                            >
                              {formatCurrency(item.difference)}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  item.status === "ACIMA"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {item.status === "ACIMA" ? "Acima do orçamento" : "Dentro do orçamento"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Folha Orçada x Atual — 12 meses">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(payroll?.byMonth ?? []).map((m) => ({ ...m, monthLabel: FULL_MONTH_LABELS[m.month] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      tickFormatter={(v) => formatCurrency(v)}
                      width={90}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="payrollBudgeted" stroke="#94a3b8" strokeWidth={2} dot={false} name="Orçado" />
                    <Line type="monotone" dataKey="payrollCurrent" stroke="#00AFAA" strokeWidth={2} dot={false} name="Atual" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title={`Folha do Ano ${payroll?.year ?? ""} — Fechado x Orçado`}>
              <p className="mb-2 -mt-2 text-xs text-brand-text">
                Janeiro a dezembro: meses já fechados usam o fechamento real da folha; meses futuros são
                projetados a partir do último fechamento, já somando o impacto de mérito, promoção e
                aumento de quadro aprovados a partir do mês de vigência de cada um. A linha tracejada é o
                orçado do mês; barras em vermelho estouraram o orçamento.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={(financial?.annualPayrollProjection ?? []).map((p) => ({
                      monthLabel: FULL_MONTH_LABELS[p.month],
                      value: p.value,
                      budgeted: p.budgeted,
                      closed: p.closed,
                      overBudget: p.overBudget,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      tickFormatter={(v) => formatCurrency(v)}
                      width={90}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend
                      payload={[
                        { value: "Fechado", type: "square", color: "#00AFAA" },
                        { value: "Projetado", type: "square", color: "#99DEDB" },
                        { value: "Acima do orçado", type: "square", color: "#dc2626" },
                        { value: "Orçado", type: "line", color: "#94a3b8" },
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="budgeted"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      name="Orçado"
                    />
                    <Bar dataKey="value" name="Folha" radius={[4, 4, 0, 0]} legendType="none">
                      {(financial?.annualPayrollProjection ?? []).map((p) => (
                        <Cell
                          key={p.month}
                          fill={p.overBudget ? "#dc2626" : p.closed ? "#00AFAA" : "#99DEDB"}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Compara todas as diretorias entre si — GESTOR não deve ver esse comparativo cross-empresa. */}
            {!hasRole("GESTOR") && (
              <Card title="Ranking de Diretorias — % Orçamento Consumido">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financial?.directorateRanking ?? []} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="directorate" tick={{ fontSize: 12 }} stroke="#94a3b8" width={120} />
                      <Tooltip formatter={(v: number) => formatPercent(v)} />
                      <Bar dataKey="consumedPercent" fill="#00AFAA" radius={[0, 4, 4, 0]} name="% Consumido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <Card title="Headcount Orçado x Atual — período selecionado">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(headcount?.byMonth ?? []).map((m) => ({ ...m, monthLabel: FULL_MONTH_LABELS[m.month] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="hcBudgeted" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Orçado" />
                    <Bar dataKey="hcCurrent" fill="#00AFAA" radius={[4, 4, 0, 0]} name="Atual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
