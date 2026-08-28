"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { CostCenterCheckboxList } from "@/components/shared/CostCenterCheckboxList";
import { useCostCenters, useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { BudgetAdjustment } from "@/types";

type Scope = "TODOS" | "DIRETORIA" | "CENTRO_RESULTADO";

export default function BudgetAdjustmentAdminPage() {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <BudgetAdjustmentAdminContent />
    </RoleGuard>
  );
}

function BudgetAdjustmentAdminContent() {
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { costCenters } = useCostCenters();

  const [year, setYear] = useState(new Date().getFullYear());
  const [adjustments, setAdjustments] = useState<BudgetAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("TODOS");
  const [directorateId, setDirectorateId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [costCenterIds, setCostCenterIds] = useState<string[]>([]);
  const [percent, setPercent] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (targetYear: number) => {
      setLoading(true);
      try {
        const res = await api.get<BudgetAdjustment[]>("/budget/adjustment", { year: targetYear });
        setAdjustments(res ?? []);
      } catch (err) {
        showToast(getErrorMessage(err), "error");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    load(year);
  }, [year, load]);

  function resetForm() {
    setEditingId(null);
    setScope("TODOS");
    setDirectorateId("");
    setCostCenterId("");
    setCostCenterIds([]);
    setPercent("");
  }

  function editRow(row: BudgetAdjustment) {
    setEditingId(row.id);
    setScope(row.costCenterId ? "CENTRO_RESULTADO" : row.directorateId ? "DIRETORIA" : "TODOS");
    setDirectorateId(row.directorateId ?? "");
    setCostCenterId(row.costCenterId ?? "");
    setPercent(row.percent);
  }

  async function handleSave() {
    if (percent === "" || Number(percent) <= 0) {
      showToast("Informe um percentual maior que zero.", "error");
      return;
    }
    if (scope !== "TODOS" && !directorateId) {
      showToast("Selecione a diretoria.", "error");
      return;
    }
    if (scope === "CENTRO_RESULTADO" && !editingId && costCenterIds.length === 0) {
      showToast("Selecione ao menos um centro de resultado.", "error");
      return;
    }
    if (scope === "CENTRO_RESULTADO" && editingId && !costCenterId) {
      showToast("Selecione o centro de resultado.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put<BudgetAdjustment>("/budget/adjustment", {
          year,
          percent: Number(percent),
          directorateId: scope === "TODOS" ? undefined : directorateId,
          costCenterId: scope === "CENTRO_RESULTADO" ? costCenterId : undefined,
        });
      } else if (scope === "CENTRO_RESULTADO") {
        await Promise.all(
          costCenterIds.map((id) =>
            api.put<BudgetAdjustment>("/budget/adjustment", {
              year,
              percent: Number(percent),
              directorateId,
              costCenterId: id,
            })
          )
        );
      } else {
        await api.put<BudgetAdjustment>("/budget/adjustment", {
          year,
          percent: Number(percent),
          directorateId: scope === "TODOS" ? undefined : directorateId,
        });
      }
      const scopeCount = scope === "CENTRO_RESULTADO" && !editingId ? costCenterIds.length : 1;
      showToast(
        scopeCount > 1
          ? `Ajuste de ${year} salvo em ${scopeCount} centros de resultado: orçado passa a ser exibido a ${percent}%.`
          : `Ajuste de ${year} salvo: orçado passa a ser exibido a ${percent}% nesse escopo.`,
        "success"
      );
      resetForm();
      await load(year);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: BudgetAdjustment) {
    try {
      await api.delete(`/budget/adjustment/${row.id}`);
      showToast("Ajuste removido — o escopo volta a 100% (sem ajuste).", "success");
      if (editingId === row.id) resetForm();
      await load(year);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  }

  function scopeLabel(row: BudgetAdjustment): string {
    if (row.costCenterId) {
      const cc = costCenters.find((c) => c.id === row.costCenterId);
      const dir = directorates.find((d) => d.id === row.directorateId);
      return `${cc?.name ?? "—"} (${dir?.name ?? "—"})`;
    }
    if (row.directorateId) {
      const dir = directorates.find((d) => d.id === row.directorateId);
      return `Diretoria: ${dir?.name ?? "—"}`;
    }
    return "Todos (empresa inteira)";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ajuste de Orçamento</h1>
        <p className="text-sm text-brand-text">
          Define, por ano, um percentual do orçamento importado que fica disponível — ex.: 90% reduz todo
          &quot;orçado&quot; em R$ exibido no Dashboard, no Simulador e no comparativo de colaboradores para 90% do que foi importado
          (100.000,00 orçados passam a aparecer como 90.000,00), refletindo em todos os meses do ano. Pode valer para
          toda a empresa, só para uma diretoria ou para um ou mais centros de resultado específicos — quando mais de
          uma regra se aplicar, a mais específica vence. Não altera a planilha original nem a contagem de HC/vagas orçadas — só o
          valor em R$ mostrado. Visível e editável apenas pelo perfil Administrador.
        </p>
      </div>

      <Card title={editingId ? "Editar regra" : "Nova regra"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Ano" type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          <Select
            label="Escopo"
            options={[
              { value: "TODOS", label: "Todos (empresa inteira)" },
              { value: "DIRETORIA", label: "Uma diretoria" },
              { value: "CENTRO_RESULTADO", label: "Um centro de resultado" },
            ]}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              if (e.target.value === "TODOS") {
                setDirectorateId("");
                setCostCenterId("");
                setCostCenterIds([]);
              }
            }}
          />
          {scope !== "TODOS" && (
            <Select
              label="Diretoria"
              placeholder="Selecione"
              options={directorates.map((d) => ({ value: d.id, label: d.name }))}
              value={directorateId}
              onChange={(e) => setDirectorateId(e.target.value)}
            />
          )}
          {scope === "CENTRO_RESULTADO" && editingId && (
            <Select
              label="Centro de resultado"
              placeholder="Selecione"
              options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
            />
          )}
          {scope === "CENTRO_RESULTADO" && !editingId && (
            <div className="sm:col-span-2 lg:col-span-1">
              <CostCenterCheckboxList
                selectedIds={costCenterIds}
                onChange={setCostCenterIds}
                label="Centros de resultado"
                hint="Pode selecionar mais de um — o mesmo percentual será aplicado a todos os selecionados."
              />
            </div>
          )}
          <Input
            label="Percentual disponibilizado (%)"
            type="number"
            step="0.01"
            min={1}
            max={300}
            value={percent}
            onChange={(e) => setPercent(e.target.value === "" ? "" : Number(e.target.value))}
            hint="100 = sem ajuste. Ex.: 90 mostra 90% do orçado."
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {editingId && (
            <Button variant="outline" onClick={resetForm} disabled={saving}>
              Cancelar edição
            </Button>
          )}
          <Button onClick={handleSave} loading={saving}>
            {editingId ? "Salvar alteração" : "Adicionar regra"}
          </Button>
        </div>
      </Card>

      <Card title={`Regras configuradas para ${year}`}>
        {loading ? (
          <Spinner />
        ) : adjustments.length === 0 ? (
          <p className="text-sm text-brand-text">Nenhum ajuste configurado para {year} — todo orçado é exibido a 100%.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="py-2">Escopo</th>
                  <th className="py-2 text-right">Percentual</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((row) => (
                  <tr key={row.id} className="border-b border-brand-border last:border-0">
                    <td className="py-2 text-slate-800">{scopeLabel(row)}</td>
                    <td className="py-2 text-right text-slate-800">{row.percent}%</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => editRow(row)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
