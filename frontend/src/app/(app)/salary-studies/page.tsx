"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { MarketClassificationBadge } from "@/components/ui/StatusBadge";
import { DirectorateSelect } from "@/components/shared/Filters";
import { useAuth } from "@/lib/auth";
import { useDirectorates, usePositions } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { SalaryPositioningItem, SalaryStudy } from "@/types";

export default function SalaryStudiesPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const canImport = hasRole("ADMIN", "RH_REMUNERACAO");

  const [studies, setStudies] = useState<SalaryStudy[]>([]);
  const [loadingStudies, setLoadingStudies] = useState(true);

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true);
    try {
      const res = await api.get<SalaryStudy[]>("/salary-studies");
      setStudies(res ?? []);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoadingStudies(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  const studyColumns: Column<SalaryStudy>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "source", header: "Fonte", render: (r) => r.source },
    { key: "year", header: "Ano de Referência", render: (r) => r.referenceYear },
    { key: "entries", header: "Registros", render: (r) => r.entriesCount ?? "—", align: "right" },
    { key: "importedAt", header: "Importado em", render: (r) => formatDate(r.importedAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Estudos Salariais</h1>
        <p className="text-sm text-slate-500">Pesquisas de mercado e posicionamento salarial dos colaboradores.</p>
      </div>

      {canImport && <ImportStudyCard onImported={loadStudies} />}

      <Card title="Estudos importados">
        <Table columns={studyColumns} data={studies} rowKey={(r) => r.id} loading={loadingStudies} />
      </Card>

      <PositioningCard />
    </div>
  );
}

function ImportStudyCard({ onImported }: { onImported: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [referenceYear, setReferenceYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (!name || !source || !referenceYear || !file) {
      showToast("Preencha nome, fonte, ano de referência e selecione o arquivo.", "error");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("source", source);
      formData.append("referenceYear", referenceYear);
      await api.upload("/salary-studies/import", formData);
      showToast("Estudo salarial importado com sucesso.", "success");
      setName("");
      setSource("");
      setFile(null);
      onImported();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card title="Importar estudo salarial" subtitle="Envie uma pesquisa de mercado (.xlsx) com faixas salariais por cargo.">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Nome do estudo" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pesquisa Mercer 2026" />
          <Input label="Fonte" required value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex: Mercer, Hay Group..." />
          <Input
            label="Ano de referência"
            type="number"
            required
            value={referenceYear}
            onChange={(e) => setReferenceYear(e.target.value)}
          />
        </div>
        <FileDropzone file={file} onFileSelected={setFile} accept=".xlsx,.xls" />
        <div>
          <Button onClick={handleImport} loading={importing}>
            Importar estudo
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PositioningCard() {
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();
  const [directorateId, setDirectorateId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [items, setItems] = useState<SalaryPositioningItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<SalaryPositioningItem[]>("/salary-studies/positioning", {
        directorateId: directorateId || undefined,
        positionId: positionId || undefined,
      })
      .then((res) => active && setItems(res ?? []))
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directorateId, positionId]);

  const columns: Column<SalaryPositioningItem>[] = [
    { key: "employee", header: "Colaborador", render: (r) => r.employee.name },
    { key: "position", header: "Cargo", render: (r) => r.employee.positionName ?? "—" },
    { key: "directorate", header: "Diretoria", render: (r) => r.employee.directorateName ?? "—" },
    { key: "current", header: "Salário Atual", render: (r) => formatCurrency(r.currentSalary), align: "right" },
    { key: "p50", header: "Mercado P50", render: (r) => formatCurrency(r.marketP50), align: "right" },
    { key: "p90", header: "Mercado P90", render: (r) => formatCurrency(r.marketP90), align: "right" },
    { key: "classification", header: "Classificação", render: (r) => <MarketClassificationBadge classification={r.classification} /> },
  ];

  return (
    <Card title="Posicionamento salarial vs. mercado">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectorateSelect value={directorateId} onChange={setDirectorateId} directorates={directorates} />
        <Select
          label="Cargo"
          placeholder="Todos os cargos"
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
        />
      </div>
      <Table columns={columns} data={items} rowKey={(r) => r.employee.id} loading={loading} />
    </Card>
  );
}
