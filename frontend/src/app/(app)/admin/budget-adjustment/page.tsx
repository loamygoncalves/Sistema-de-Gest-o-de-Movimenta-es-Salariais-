"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { BudgetAdjustment } from "@/types";

export default function BudgetAdjustmentAdminPage() {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <BudgetAdjustmentAdminContent />
    </RoleGuard>
  );
}

function BudgetAdjustmentAdminContent() {
  const { showToast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [percent, setPercent] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const res = await api.get<BudgetAdjustment>("/budget/adjustment", { year: targetYear });
      setPercent(res?.percent ?? 100);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  async function handleSave() {
    if (percent === "" || Number(percent) <= 0) {
      showToast("Informe um percentual maior que zero.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<BudgetAdjustment>("/budget/adjustment", { year, percent: Number(percent) });
      setPercent(res?.percent ?? Number(percent));
      showToast(`Ajuste de ${year} salvo: orçado passa a ser exibido a ${res?.percent ?? percent}%.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ajuste de Orçamento</h1>
        <p className="text-sm text-brand-text">
          Define, por ano, um percentual do orçamento importado que fica disponível — ex.: 90% reduz todo "orçado" em
          R$ exibido no Dashboard, no Simulador e no comparativo de colaboradores para 90% do que foi importado
          (100.000,00 orçados em um centro de custo passam a aparecer como 90.000,00), refletindo em todos os meses
          do ano. Não altera a planilha original nem a contagem de HC/vagas orçadas — só o valor em R$ mostrado.
          Visível e editável apenas pelo perfil Administrador.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-4 sm:max-w-sm">
            <Input
              label="Ano"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
            <Input
              label="Percentual disponibilizado (%)"
              type="number"
              step="0.01"
              min={1}
              max={300}
              value={percent}
              onChange={(e) => setPercent(e.target.value === "" ? "" : Number(e.target.value))}
              hint="100 = sem ajuste (valor original importado). Ex.: 90 mostra 90% do orçado."
            />
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          Salvar ajuste
        </Button>
      </div>
    </div>
  );
}
