"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Table, Column } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { PageLoading } from "@/components/ui/Spinner";
import { BudgetMovementTypeBadge } from "@/components/ui/StatusBadge";
import { ImportResultCard } from "@/components/shared/ImportResultCard";
import { DirectorateSelect, MonthSelect, YearSelect } from "@/components/shared/Filters";
import { useAuth } from "@/lib/auth";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  BudgetDashboard,
  BudgetEntry,
  FULL_MONTH_LABELS,
  ImportBatch,
  MONTH_KEYS,
  MONTH_LABELS,
  Paginated,
} from "@/types";

export default function BudgetPage() {
  const { hasRole } = useAuth();
  const { directorates } = useDirectorates();
  const { showToast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
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
      .get<BudgetDashboard>("/budget/dashboard", { year, month, directorateId: directorateId || undefined })
      .then((res) => active && setDashboard(res))
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoadingDashboard(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, directorateId]);

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
        setEntries(res.items ?? []);
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
    { key: "costCenter", header: "Centro de Resultado", render: (r) => r.costCenterName ?? "—" },
    { key: "position", header: "Cargo", render: (r) => r.positionName ?? "—" },
    {
      key: "movementType",
      header: "Tipo de Movimentação",
      render: (r) => <BudgetMovementTypeBadge type={r.movementType} />,
    },
    ...MONTH_KEYS.map<Column<BudgetEntry>>((monthKey) => ({
      key: monthKey,
      header: MONTH_LABELS[monthKey],
      align: "right" as const,
      render: (r) => {
        const value = r[monthKey];
        return value === null || value === undefined ? (
          <span className="text-slate-300">–</span>
        ) : (
          formatCurrency(value)
        );
      },
    })),
  ];

  const referenceLabel = dashboard ? `${FULL_MONTH_LABELS[dashboard.month]}/${dashboard.year}` : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orçamento</h1>
          <p className="text-sm text-brand-text">Controle de headcount e folha orçada por diretoria, centro de resultado e cargo.</p>
        </div>
        <div className="flex gap-3">
          <YearSelect value={year} onChange={setYear} />
          <MonthSelect value={month} onChange={setMonth} />
          <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        </div>
      </div>

      {loadingDashboard ? (
        <PageLoading />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="HC Orçado (mês)" value={formatNumber(dashboard?.hcBudgeted)} hint={`Mês de referência: ${referenceLabel}`} />
            <KpiCard label="Folha Orçada (mês)" value={formatCurrency(dashboard?.payrollBudgeted)} hint={`Mês de referência: ${referenceLabel}`} />
            <KpiCard label="Orçamento Anual Total" value={formatCurrency(dashboard?.annualBudgeted)} hint={`Soma das 12 colunas mensais — ano ${dashboard?.year ?? year}`} />
          </div>
        </div>
      )}

      {canImport && (
        <Card
          title="Importar orçamento"
          subtitle="Envie a planilha (.xlsx) com o orçamento por diretoria, centro de resultado, cargo e tipo de movimentação."
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-brand-text">
              Colunas esperadas: <strong>DIRETORIA</strong>, <strong>CENTRO DE RESULTADO</strong>, <strong>CARGO</strong>,{" "}
              <strong>TIPO DE MOVIMENTAÇÃO</strong> (Sem Movimentação, Promoção, Mérito, Substituição, Aumento de
              Quadro ou Desligamento), seguidas das 12 colunas de mês (Jan a Dez) com o custo orçado de cada mês —
              deixe a célula em branco no(s) mês(es) sem custo orçado. Linhas idênticas são permitidas e representam
              vagas/assentos distintos daquela combinação. Reimportar substitui integralmente o orçado do ano para as
              diretorias presentes no arquivo.
            </p>
            <div className="max-w-xs">
              <YearSelect value={importYear} onChange={setImportYear} label="Ano de referência da importação" />
            </div>
            <FileDropzone
              file={file}
              onFileSelected={setFile}
              accept=".xlsx,.xls"
              hint="Planilha (.xlsx) com diretoria, centro de resultado, cargo, tipo de movimentação e 12 colunas de mês"
            />
            <div>
              <Button onClick={handleImport} loading={importing} disabled={!file}>
                Importar planilha
              </Button>
            </div>
          </div>
        </Card>
      )}

      {batch && <ImportResultCard batch={batch} />}

      <Card
        title="Lançamentos orçamentários"
        subtitle="Cada linha é uma vaga/assento orçado; combinações repetidas representam vagas distintas do mesmo tipo."
      >
        <Table columns={columns} data={entries} rowKey={(r) => r.id} loading={loadingEntries} />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
