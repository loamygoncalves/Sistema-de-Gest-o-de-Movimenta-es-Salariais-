"use client";

import React, { useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { ImportResultCard } from "@/components/shared/ImportResultCard";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDirectorates, useManagements } from "@/hooks/useOrgOptions";
import { useToast } from "@/lib/toast";
import { api } from "@/lib/api";
import { getErrorMessage, formatCurrency } from "@/lib/format";
import { Coordination, CostCenter, Directorate, ImportBatch, Management, Position } from "@/types";

type Tab = "directorates" | "managements" | "coordinations" | "positions" | "costCenters";

const TABS: { key: Tab; label: string }[] = [
  { key: "directorates", label: "Diretorias" },
  { key: "managements", label: "Gerências" },
  { key: "coordinations", label: "Coordenações" },
  { key: "positions", label: "Cargos" },
  { key: "costCenters", label: "Centros de Custo" },
];

export default function OrganizationAdminPage() {
  const [tab, setTab] = useState<Tab>("directorates");

  return (
    <RoleGuard roles={["ADMIN", "RH_REMUNERACAO"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Estrutura Organizacional</h1>
          <p className="text-sm text-brand-text">Diretorias, gerências, coordenações, cargos e centros de custo.</p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-brand-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t.key ? "border-b-2 border-brand-teal text-brand-teal-dark" : "text-brand-text hover:text-brand-teal-dark"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "directorates" && <DirectoratesTab />}
        {tab === "managements" && <ManagementsTab />}
        {tab === "coordinations" && <CoordinationsTab />}
        {tab === "positions" && <PositionsTab />}
        {tab === "costCenters" && <CostCentersTab />}
      </div>
    </RoleGuard>
  );
}

function DirectoratesTab() {
  const { items, loading, create, update } = useCrudResource<Directorate>("/directorates");
  const { showToast } = useToast();
  const [modalItem, setModalItem] = useState<Partial<Directorate> | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Directorate>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "code", header: "Código", render: (r) => r.code ?? "—" },
    { key: "budget", header: "Orçamento Anual", render: (r) => formatCurrency(r.annualBudget), align: "right" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setModalItem(r)}>
          Editar
        </Button>
      ),
    },
  ];

  async function handleSave() {
    if (!modalItem?.name) {
      showToast("Informe o nome da diretoria.", "error");
      return;
    }
    setSaving(true);
    try {
      if (modalItem.id) {
        await update(modalItem.id, modalItem);
      } else {
        await create(modalItem);
      }
      showToast("Diretoria salva com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Diretorias"
      actions={<Button size="sm" onClick={() => setModalItem({})}>Nova diretoria</Button>}
    >
      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
      <Modal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        title={modalItem?.id ? "Editar diretoria" : "Nova diretoria"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome" required value={modalItem?.name ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))} />
          <Input label="Código" value={modalItem?.code ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, code: e.target.value }))} />
          <Input
            label="Orçamento anual"
            type="number"
            step="0.01"
            value={modalItem?.annualBudget ?? ""}
            onChange={(e) => setModalItem((m) => ({ ...m, annualBudget: Number(e.target.value) }))}
          />
        </div>
      </Modal>
    </Card>
  );
}

function ManagementsTab() {
  const { directorates } = useDirectorates();
  const { items, loading, create, update } = useCrudResource<Management>("/managements");
  const { showToast } = useToast();
  const [modalItem, setModalItem] = useState<Partial<Management> | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Management>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setModalItem(r)}>
          Editar
        </Button>
      ),
    },
  ];

  async function handleSave() {
    if (!modalItem?.name || !modalItem?.directorateId) {
      showToast("Informe o nome e a diretoria.", "error");
      return;
    }
    setSaving(true);
    try {
      if (modalItem.id) {
        await update(modalItem.id, modalItem);
      } else {
        await create(modalItem);
      }
      showToast("Gerência salva com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Gerências" actions={<Button size="sm" onClick={() => setModalItem({})}>Nova gerência</Button>}>
      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
      <Modal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        title={modalItem?.id ? "Editar gerência" : "Nova gerência"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome" required value={modalItem?.name ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))} />
          <Select
            label="Diretoria"
            required
            placeholder="Selecione"
            options={directorates.map((d) => ({ value: d.id, label: d.name }))}
            value={modalItem?.directorateId ?? ""}
            onChange={(e) => setModalItem((m) => ({ ...m, directorateId: e.target.value }))}
          />
        </div>
      </Modal>
    </Card>
  );
}

function CoordinationsTab() {
  const { directorates } = useDirectorates();
  const [directorateId, setDirectorateId] = useState("");
  const { managements } = useManagements(directorateId || undefined);
  const { items, loading, create } = useCrudResource<Coordination>("/coordinations");
  const { showToast } = useToast();
  const [modalItem, setModalItem] = useState<Partial<Coordination> | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Coordination>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "management", header: "Gerência", render: (r) => r.managementName ?? "—" },
  ];

  async function handleSave() {
    if (!modalItem?.name || !modalItem?.managementId) {
      showToast("Informe o nome e a gerência.", "error");
      return;
    }
    setSaving(true);
    try {
      await create(modalItem);
      showToast("Coordenação criada com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Coordenações" actions={<Button size="sm" onClick={() => setModalItem({})}>Nova coordenação</Button>}>
      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
      <Modal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        title="Nova coordenação"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome" required value={modalItem?.name ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))} />
          <Select
            label="Diretoria"
            placeholder="Selecione para filtrar gerências"
            options={directorates.map((d) => ({ value: d.id, label: d.name }))}
            value={directorateId}
            onChange={(e) => setDirectorateId(e.target.value)}
          />
          <Select
            label="Gerência"
            required
            placeholder="Selecione"
            options={managements.map((m) => ({ value: m.id, label: m.name }))}
            value={modalItem?.managementId ?? ""}
            onChange={(e) => setModalItem((m) => ({ ...m, managementId: e.target.value }))}
          />
        </div>
      </Modal>
    </Card>
  );
}

function PositionsTab() {
  const { items, loading, create, update } = useCrudResource<Position>("/positions");
  const { showToast } = useToast();
  const [modalItem, setModalItem] = useState<Partial<Position> | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Position>[] = [
    { key: "name", header: "Cargo", render: (r) => r.name },
    { key: "level", header: "Nível", render: (r) => r.level ?? "—" },
    { key: "min", header: "Faixa Mínima", render: (r) => formatCurrency(r.salaryRangeMin), align: "right" },
    { key: "max", header: "Faixa Máxima", render: (r) => formatCurrency(r.salaryRangeMax), align: "right" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setModalItem(r)}>
          Editar
        </Button>
      ),
    },
  ];

  async function handleSave() {
    if (!modalItem?.name) {
      showToast("Informe o nome do cargo.", "error");
      return;
    }
    setSaving(true);
    try {
      if (modalItem.id) {
        await update(modalItem.id, modalItem);
      } else {
        await create(modalItem);
      }
      showToast("Cargo salvo com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Cargos" actions={<Button size="sm" onClick={() => setModalItem({})}>Novo cargo</Button>}>
      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
      <Modal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        title={modalItem?.id ? "Editar cargo" : "Novo cargo"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome do cargo" required value={modalItem?.name ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))} />
          <Input label="Nível" value={modalItem?.level ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, level: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Faixa mínima"
              type="number"
              step="0.01"
              value={modalItem?.salaryRangeMin ?? ""}
              onChange={(e) => setModalItem((m) => ({ ...m, salaryRangeMin: Number(e.target.value) }))}
            />
            <Input
              label="Faixa máxima"
              type="number"
              step="0.01"
              value={modalItem?.salaryRangeMax ?? ""}
              onChange={(e) => setModalItem((m) => ({ ...m, salaryRangeMax: Number(e.target.value) }))}
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function CostCentersTab() {
  const { directorates } = useDirectorates();
  const { items, loading, create, update, reload } = useCrudResource<CostCenter>("/cost-centers");
  const { showToast } = useToast();
  const [modalItem, setModalItem] = useState<Partial<CostCenter> | null>(null);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importBatch, setImportBatch] = useState<ImportBatch | null>(null);

  async function handleImport() {
    if (!importFile) {
      showToast("Selecione um arquivo para importar.", "error");
      return;
    }
    setImporting(true);
    setImportBatch(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.upload<ImportBatch>("/cost-centers/import", formData);
      setImportBatch(res);
      showToast("Importação de centros de custo concluída.", "success");
      setImportFile(null);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  const columns: Column<CostCenter>[] = [
    { key: "code", header: "Código", render: (r) => r.code },
    { key: "name", header: "Nome", render: (r) => r.name },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setModalItem(r)}>
          Editar
        </Button>
      ),
    },
  ];

  async function handleSave() {
    if (!modalItem?.code || !modalItem?.name) {
      showToast("Informe o código e o nome.", "error");
      return;
    }
    setSaving(true);
    try {
      if (modalItem.id) {
        await update(modalItem.id, modalItem);
      } else {
        await create(modalItem);
      }
      showToast("Centro de custo salvo com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Importar centros de custo"
        subtitle="Envie uma planilha (.xlsx) com apenas os nomes dos centros de custo — o código é gerado automaticamente."
      >
        <div className="flex flex-col gap-4">
          <FileDropzone file={importFile} onFileSelected={setImportFile} accept=".xlsx,.xls" />
          <div>
            <Button onClick={handleImport} loading={importing} disabled={!importFile}>
              Importar planilha
            </Button>
          </div>
        </div>
      </Card>
      {importBatch && <ImportResultCard batch={importBatch} />}

      <Card title="Centros de Custo" actions={<Button size="sm" onClick={() => setModalItem({})}>Novo centro de custo</Button>}>
        <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
        <Modal
          open={!!modalItem}
          onClose={() => setModalItem(null)}
          title={modalItem?.id ? "Editar centro de custo" : "Novo centro de custo"}
          footer={
            <>
              <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>Salvar</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input label="Código" required value={modalItem?.code ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, code: e.target.value }))} />
            <Input label="Nome" required value={modalItem?.name ?? ""} onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))} />
            <Select
              label="Diretoria (opcional)"
              placeholder="Nenhuma"
              options={directorates.map((d) => ({ value: d.id, label: d.name }))}
              value={modalItem?.directorateId ?? ""}
              onChange={(e) => setModalItem((m) => ({ ...m, directorateId: e.target.value }))}
            />
          </div>
        </Modal>
      </Card>
    </div>
  );
}
