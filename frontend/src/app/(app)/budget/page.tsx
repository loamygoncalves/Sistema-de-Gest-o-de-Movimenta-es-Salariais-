"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Table, Column } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { PageLoading } from "@/components/ui/Spinner";
import { ImportResultCard } from "@/components/shared/ImportResultCard";
import { DirectorateSelect, YearSelect } from "@/components/shared/Filters";
import { useAuth } from "@/lib/auth";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { BudgetDashboard, BudgetEntry, ImportBatch, Paginated } from "@/types";

export default function BudgetPage() {
  const { hasRole } = useAuth();
  const { directorates } = useDirectorates();
  const { showToast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear());
  const [directorateId, setDirectorateId] = useState("");

  const [dashboard, setDashboard] = useState<BudgetDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const limit = 10;

  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [batch, setBatch] = useState<ImportBatch | null>(null);

  const canImport = hasRole("ADMIN", "RH_REMUNERACAO");

  useEffect(() => {
    let active = true;
    setLoadingDashboard(true);
    api
      .get<BudgetDashboard>("/budget/dashboard", { year, directorateId: directorateId || undefined })
      .then((res) => active && setDashboard(res))
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoadingDashboard(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, directorateId]);

  useEffect(() => {
    let active = true;
    setLoadingEntries(true);
    api
      .get<Paginated<BudgetEntry>>("/budget/entries", {
        year,
        directorateId: directorateId || undefined,
        page,
        limit,
      })
      .then((res) => {
        if (!active) return;
        setEntries(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoadingEntries(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, directorateId, page]);

  async function handleImport() {
    if (!file) {
      showToast("Selecione um arquivo para importar.", "error");
      return;
    }
    setImporting(true);
    setBatch(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<ImportBatch>("/budget/import", formData, { year: importYear });
      setBatch(res);
      showToast("Importação de orçamento concluída.", "success");
      setPage(1);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  const columns: Column<BudgetEntry>[] = [
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? "—" },
    { key: "position", header: "Cargo", render: (r) => r.positionName ?? "—" },
    { key: "hc", header: "HC Orçado", render: (r) => formatNumber(r.budgetedHeadcount), align: "right" },
    { key: "salary", header: "Folha Orçada", render: (r) => formatCurrency(r.budgetedSalary), align: "right" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orçamento</h1>
          <p className="text-sm text-slate-500">Controle de headcount e folha orçada por diretoria.</p>
        </div>
        <div className="flex gap-3">
          <YearSelect value={year} onChange={setYear} />
          <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        </div>
      </div>

      {loadingDashboard ? (
        <PageLoading />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="HC Orçado" value={formatNumber(dashboard?.hcBudgeted)} />
          <KpiCard label="HC Atual" value={formatNumber(dashboard?.hcCurrent)} />
          <KpiCard
            label="Diferença HC"
            value={formatNumber(dashboard?.hcDifference)}
            tone={(dashboard?.hcDifference ?? 0) < 0 ? "danger" : "default"}
          />
          <KpiCard label="Folha Orçada" value={formatCurrency(dashboard?.payrollBudgeted)} />
          <KpiCard label="Folha Atual" value={formatCurrency(dashboard?.payrollCurrent)} />
          <KpiCard
            label="Desvio Financeiro"
            value={formatCurrency(dashboard?.financialDeviation)}
            tone={(dashboard?.financialDeviation ?? 0) > 0 ? "danger" : "success"}
          />
          <KpiCard
            className="col-span-full sm:col-span-2"
            label="% Orçamento Consumido"
            value={formatPercent(dashboard?.budgetConsumedPercent)}
            tone={(dashboard?.budgetConsumedPercent ?? 0) > 100 ? "danger" : "default"}
          />
        </div>
      )}

      {canImport && (
        <Card title="Importar orçamento" subtitle="Envie a planilha (.xlsx) com o orçamento anual por diretoria/cargo.">
          <div className="flex flex-col gap-4">
            <div className="max-w-xs">
              <YearSelect value={importYear} onChange={setImportYear} label="Ano de referência da importação" />
            </div>
            <FileDropzone file={file} onFileSelected={setFile} accept=".xlsx,.xls" />
            <div>
              <Button onClick={handleImport} loading={importing} disabled={!file}>
                Importar planilha
              </Button>
            </div>
          </div>
        </Card>
      )}

      {batch && <ImportResultCard batch={batch} />}

      <Card title="Lançamentos orçamentários">
        <Table columns={columns} data={entries} rowKey={(r) => r.id} loading={loadingEntries} />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
