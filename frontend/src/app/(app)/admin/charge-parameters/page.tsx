"use client";

import React, { useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { useCrudResource } from "@/hooks/useCrudResource";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  CHARGE_PARAMETER_CATEGORY_LABELS,
  CHARGE_PARAMETER_TYPE_LABELS,
  ChargeParameter,
  ChargeParameterCategory,
  ChargeParameterType,
  UpsertChargeParameterPayload,
} from "@/types";

const CATEGORY_OPTIONS = Object.entries(CHARGE_PARAMETER_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(CHARGE_PARAMETER_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function ChargeParametersAdminPage() {
  return (
    <RoleGuard roles={["ADMIN", "RH_REMUNERACAO"]}>
      <ChargeParametersContent />
    </RoleGuard>
  );
}

function ChargeParametersContent() {
  const { items, loading, create, update } = useCrudResource<ChargeParameter>("/charge-parameters");
  const { showToast } = useToast();

  const [modalItem, setModalItem] = useState<Partial<ChargeParameter> | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!modalItem?.name || !modalItem?.category || !modalItem?.type || modalItem.value === undefined) {
      showToast("Preencha nome, categoria, tipo e valor.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: UpsertChargeParameterPayload = {
        name: modalItem.name,
        category: modalItem.category as ChargeParameterCategory,
        type: modalItem.type as ChargeParameterType,
        value: Number(modalItem.value),
        active: modalItem.active ?? true,
      };
      if (modalItem.id) {
        await update(modalItem.id, payload);
      } else {
        await create(payload);
      }
      showToast("Parâmetro salvo com sucesso.", "success");
      setModalItem(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: ChargeParameter) {
    try {
      await update(item.id, { active: !item.active });
      showToast(item.active ? "Parâmetro desativado." : "Parâmetro reativado.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  }

  const columns: Column<ChargeParameter>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    {
      key: "category",
      header: "Categoria",
      render: (r) => (
        <Badge color={r.category === "ENCARGO" ? "amber" : "blue"}>
          {CHARGE_PARAMETER_CATEGORY_LABELS[r.category]}
        </Badge>
      ),
    },
    { key: "type", header: "Tipo", render: (r) => CHARGE_PARAMETER_TYPE_LABELS[r.type] },
    {
      key: "value",
      header: "Valor",
      render: (r) => (r.type === "PERCENTUAL" ? `${r.value}%` : r.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })),
      align: "right",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge color={r.active ? "green" : "slate"}>{r.active ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setModalItem(r)}>
            Editar
          </Button>
          <Button size="sm" variant={r.active ? "danger" : "secondary"} onClick={() => handleToggleActive(r)}>
            {r.active ? "Desativar" : "Reativar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Encargos & Benefícios</h1>
          <p className="text-sm text-slate-500">
            Parâmetros percentuais/fixos usados pelo simulador de impacto do módulo de movimentações.
          </p>
        </div>
        <Button onClick={() => setModalItem({ category: "ENCARGO", type: "PERCENTUAL", active: true })}>
          Novo parâmetro
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />
      </Card>

      <Modal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        title={modalItem?.id ? "Editar parâmetro" : "Novo parâmetro"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nome"
            required
            placeholder="Ex: INSS Patronal, Vale Refeição..."
            value={modalItem?.name ?? ""}
            onChange={(e) => setModalItem((m) => ({ ...m, name: e.target.value }))}
          />
          <Select
            label="Categoria"
            required
            options={CATEGORY_OPTIONS}
            value={modalItem?.category ?? "ENCARGO"}
            onChange={(e) => setModalItem((m) => ({ ...m, category: e.target.value as ChargeParameterCategory }))}
          />
          <Select
            label="Tipo"
            required
            options={TYPE_OPTIONS}
            value={modalItem?.type ?? "PERCENTUAL"}
            onChange={(e) => setModalItem((m) => ({ ...m, type: e.target.value as ChargeParameterType }))}
          />
          <Input
            label={modalItem?.type === "FIXO" ? "Valor (R$)" : "Valor (%)"}
            type="number"
            step="0.01"
            required
            value={modalItem?.value ?? ""}
            onChange={(e) => setModalItem((m) => ({ ...m, value: Number(e.target.value) }))}
          />
        </div>
      </Modal>
    </div>
  );
}
