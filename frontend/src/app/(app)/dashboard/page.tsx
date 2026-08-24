"use client";

import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { DirectorateSelect, MonthSelect, YearSelect } from "@/components/shared/Filters";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  FinancialDashboard,
  FULL_MONTH_LABELS,
  HeadcountDashboard,
  MovementsDashboard,
  PayrollDashboard,
} from "@/types";

export default function DashboardPage() {
  const { directorates } = useDirectorates();
  const { showToast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [directorateId, setDirectorateId] = useState("");
  const [loading, setLoading] = useState(true);

  const [headcount, setHeadcount] = useState<HeadcountDashboard | null>(null);
  const [payroll, setPayroll] = useState<PayrollDashboard | null>(null);
  const [movements, setMovements] = useState<MovementsDashboard | null>(null);
  const [financial, setFinancial] = useState<FinancialDashboard | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = { year, month, directorateId: directorateId || undefined };

    Promise.all([
      api.get<HeadcountDashboard>("/dashboard/headcount", params),
      api.get<PayrollDashboard>("/dashboard/payroll", params),
      api.get<MovementsDashboard>("/dashboard/movements", { year, directorateId: directorateId || undefined }),
      api.get<FinancialDashboard>("/dashboard/financial", params),
    ])
      .then(([hc, pay, mov, fin]) => {
        if (!active) return;
        setHeadcount(hc);
        setPayroll(pay);
        setMovements(mov);
        setFinancial(fin);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, directorateId]);

  const referenceLabel = `${FULL_MONTH_LABELS[headcount?.month ?? month]}/${headcount?.year ?? year}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard Executivo</h1>
          <p className="text-sm text-brand-text">Visão consolidada de headcount, folha, movimentações e orçamento.</p>
        </div>
        <div className="flex gap-3">
          <YearSelect value={year} onChange={setYear} />
          <MonthSelect value={month} onChange={setMonth} />
          <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        </div>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Headcount</h2>
              <span className="text-xs text-brand-text">Mês de referência: {referenceLabel}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="HC Orçado" value={formatNumber(headcount?.hcBudgeted)} hint={referenceLabel} />
              <KpiCard label="HC Atual" value={formatNumber(headcount?.hcCurrent)} />
              <KpiCard label="HC Aprovado" value={formatNumber(headcount?.hcApproved)} />
              <KpiCard label="Vagas em Aberto" value={formatNumber(headcount?.hcOpen)} />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Folha de Pagamento</h2>
              <span className="text-xs text-brand-text">Mês de referência: {referenceLabel}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Folha Atual" value={formatCurrency(payroll?.payrollCurrent)} />
              <KpiCard label="Folha Orçada" value={formatCurrency(payroll?.payrollBudgeted)} hint={referenceLabel} />
              <KpiCard
                label="Diferença"
                value={formatCurrency(payroll?.difference)}
                tone={(payroll?.difference ?? 0) > 0 ? "danger" : "success"}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Movimentações</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Promoções" value={formatNumber(movements?.promotions)} />
              <KpiCard label="Méritos" value={formatNumber(movements?.merits)} />
              <KpiCard label="Aumento de Quadro" value={formatNumber(movements?.headcountIncrease)} />
              <KpiCard label="Transferências" value={formatNumber(movements?.transfers)} />
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Projeção de Impacto — 12 meses">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={financial?.projection12Months ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      tickFormatter={(v) => formatCurrency(v)}
                      width={90}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="impact" stroke="#00AFAA" strokeWidth={2} dot={false} name="Impacto" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

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
          </div>
        </>
      )}
    </div>
  );
}
