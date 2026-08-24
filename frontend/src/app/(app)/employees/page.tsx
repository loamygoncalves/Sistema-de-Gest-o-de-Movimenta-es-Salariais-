"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { EmployeeStatusBadge } from "@/components/ui/StatusBadge";
import { ImportResultCard } from "@/components/shared/ImportResultCard";
import { DirectorateSelect, YearSelect } from "@/components/shared/Filters";
import { useAuth } from "@/lib/auth";
import { useDirectorates, usePositions } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  Employee,
  EmployeeComparisonResponse,
  EMPLOYEE_STATUS_LABELS,
  ImportBatch,
  Paginated,
} from "@/types";

type Tab = "list" | "import" | "comparison";

export default function EmployeesPage() {
  const [tab, setTab] = useState<Tab>("list");
  const { hasRole } = useAuth();
  const canImport = hasRole("ADMIN", "RH_REMUNERACAO");

  const tabs: { key: Tab; label: string }[] = [
    { key: "list", label: "Colaboradores" },
    ...(canImport ? ([{ key: "import", label: "Importar Base" }] as { key: Tab; label: string }[]) : []),
    { key: "comparison", label: "Comparativo Base x Orçado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Colaboradores</h1>
        <p className="text-sm text-slate-500">Base atual de colaboradores e comparativo com o orçamento.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && <EmployeeListTab />}
      {tab === "import" && canImport && <EmployeeImportTab />}
      {tab === "comparison" && <EmployeeComparisonTab />}
    </div>
  );
}

function EmployeeListTab() {
  const router = useRouter();
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();

  const [search, setSearch] = useState("");
  const [directorateId, setDirectorateId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    const handle = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(handle);
  }, [search, directorateId, positionId, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<Paginated<Employee>>("/employees", {
        search: search || undefined,
        directorateId: directorateId || undefined,
        positionId: positionId || undefined,
        status: status || undefined,
        page,
        limit,
      })
      .then((res) => {
        if (!active) return;
        setEmployees(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, directorateId, positionId, status, page]);

  const columns: Column<Employee>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "registration", header: "Matrícula", render: (r) => r.registration ?? "—" },
    { key: "position", header: "Cargo", render: (r) => r.positionName ?? "—" },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? "—" },
    { key: "salary", header: "Salário Atual", render: (r) => formatCurrency(r.currentSalary), align: "right" },
    { key: "admission", header: "Admissão", render: (r) => formatDate(r.admissionDate) },
    { key: "status", header: "Status", render: (r) => <EmployeeStatusBadge status={r.status} /> },
  ];

  return (
    <Card>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Buscar" placeholder="Nome, matrícula, e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        <Select
          label="Cargo"
          placeholder="Todos os cargos"
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
        />
        <Select
          label="Status"
          placeholder="Todos"
          options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
      <Table
        columns={columns}
        data={employees}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => router.push(`/employees/${r.id}`)}
      />
      <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </Card>
  );
}

function EmployeeImportTab() {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [batch, setBatch] = useState<ImportBatch | null>(null);

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
      const res = await api.upload<ImportBatch>("/employees/import", formData);
      setBatch(res);
      showToast("Importação de colaboradores concluída.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Importar base de colaboradores" subtitle="Envie a planilha (.xlsx) com a base atual de colaboradores.">
        <div className="flex flex-col gap-4">
          <FileDropzone file={file} onFileSelected={setFile} accept=".xlsx,.xls" />
          <div>
            <Button onClick={handleImport} loading={importing} disabled={!file}>
              Importar planilha
            </Button>
          </div>
        </div>
      </Card>
      {batch && <ImportResultCard batch={batch} />}
    </div>
  );
}

function EmployeeComparisonTab() {
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const [year, setYear] = useState(new Date().getFullYear());
  const [directorateId, setDirectorateId] = useState("");
  const [data, setData] = useState<EmployeeComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<EmployeeComparisonResponse>("/employees/comparison", { year })
      .then((res) => active && setData(res))
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const filteredItems = (data?.items ?? []).filter(
    (item) => !directorateId || item.directorateId === directorateId
  );

  const columns: Column<(typeof filteredItems)[number]>[] = [
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName },
    { key: "position", header: "Cargo", render: (r) => r.positionName ?? "—" },
    { key: "description", header: "Descrição", render: (r) => r.description ?? "—" },
    { key: "budgeted", header: "HC Orçado", render: (r) => formatNumber(r.budgetedHeadcount), align: "right" },
    { key: "current", header: "HC Atual", render: (r) => formatNumber(r.currentHeadcount), align: "right" },
    { key: "value", header: "Valor", render: (r) => (r.value != null ? formatCurrency(r.value) : "—"), align: "right" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <YearSelect value={year} onChange={setYear} />
        <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Promoções Realizadas" value={formatNumber(data?.promotionsDone)} />
        <KpiCard label="Promoções Pendentes" value={formatNumber(data?.promotionsPending)} />
        <KpiCard label="Vagas Abertas" value={formatNumber(data?.openPositions)} />
        <KpiCard label="Excesso de HC" value={formatNumber(data?.headcountExcess)} tone={(data?.headcountExcess ?? 0) > 0 ? "danger" : "default"} />
        <KpiCard label="Economia" value={formatCurrency(data?.budgetSavings)} tone="success" />
        <KpiCard label="Estouro Orçamentário" value={formatCurrency(data?.budgetOverrun)} tone={(data?.budgetOverrun ?? 0) > 0 ? "danger" : "default"} />
      </div>

      <Card title="Detalhamento por diretoria/cargo">
        <Table columns={columns} data={filteredItems} rowKey={(r, i) => `${r.directorateId}-${r.positionId ?? i}`} loading={loading} />
      </Card>
    </div>
  );
}
