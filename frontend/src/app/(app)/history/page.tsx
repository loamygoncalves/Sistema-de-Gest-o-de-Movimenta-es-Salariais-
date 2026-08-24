"use client";

import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { DirectorateSelect } from "@/components/shared/Filters";
import { useCostCenters, useDirectorates, usePositions } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatPercent, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  HistoryIndicators,
  MOVEMENT_TYPE_LABELS,
  MovementHistoryEntry,
  Paginated,
} from "@/types";

export default function HistoryPage() {
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();
  const { costCenters } = useCostCenters();

  const [directorateId, setDirectorateId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState<MovementHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [indicators, setIndicators] = useState<HistoryIndicators | null>(null);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const limit = 10;

  const filters = {
    directorateId: directorateId || undefined,
    positionId: positionId || undefined,
    costCenterId: costCenterId || undefined,
    type: type || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<Paginated<MovementHistoryEntry>>("/history", { ...filters, page, limit })
      .then((res) => {
        if (!active) return;
        setEntries(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directorateId, positionId, costCenterId, type, startDate, endDate, page]);

  useEffect(() => {
    let active = true;
    setLoadingIndicators(true);
    api
      .get<HistoryIndicators>("/history/indicators", filters)
      .then((res) => active && setIndicators(res))
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoadingIndicators(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directorateId, positionId, costCenterId, type, startDate, endDate]);

  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(format);
    try {
      await api.download("/history/export", { ...filters, format }, `historico-movimentacoes.${format}`);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setExporting(null);
    }
  }

  const columns: Column<MovementHistoryEntry>[] = [
    { key: "type", header: "Tipo", render: (r) => MOVEMENT_TYPE_LABELS[r.type] ?? r.type },
    { key: "employee", header: "Colaborador", render: (r) => r.employeeName ?? "—" },
    { key: "position", header: "Cargo", render: (r) => r.positionName ?? "—" },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName },
    { key: "costCenter", header: "Centro de Custo", render: (r) => r.costCenterName ?? "—" },
    { key: "effectiveDate", header: "Data Efetiva", render: (r) => formatDate(r.effectiveDate) },
    { key: "monthlyImpact", header: "Impacto Mensal", render: (r) => formatCurrency(r.monthlyImpact), align: "right" },
    { key: "annualImpact", header: "Impacto Anual", render: (r) => formatCurrency(r.annualImpact), align: "right" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Histórico de Movimentações</h1>
          <p className="text-sm text-brand-text">Movimentações aprovadas e seus impactos financeiros.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("xlsx")} loading={exporting === "xlsx"}>
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")} loading={exporting === "pdf"}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {loadingIndicators ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Promoções" value={String(indicators?.promotionsCount ?? 0)} />
            <KpiCard label="Méritos" value={String(indicators?.meritsCount ?? 0)} />
            <KpiCard label="Crescimento Salarial" value={formatPercent(indicators?.salaryGrowthPercent)} />
            <KpiCard label="Impacto Acumulado" value={formatCurrency(indicators?.accumulatedImpact)} />
          </div>
          <Card title="Evolução de Headcount">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicators?.headcountEvolution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="hc" fill="#00AFAA" radius={[4, 4, 0, 0]} name="Headcount" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <DirectorateSelect
            value={directorateId}
            onChange={(v) => {
              setDirectorateId(v);
              setPage(1);
            }}
            directorates={directorates}
          />
          <Select
            label="Cargo"
            placeholder="Todos"
            options={positions.map((p) => ({ value: p.id, label: p.name }))}
            value={positionId}
            onChange={(e) => {
              setPositionId(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Centro de Custo"
            placeholder="Todos"
            options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
            value={costCenterId}
            onChange={(e) => {
              setCostCenterId(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Tipo"
            placeholder="Todos"
            options={Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Data inicial"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Data final"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Table columns={columns} data={entries} rowKey={(r) => r.id} loading={loading} />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
