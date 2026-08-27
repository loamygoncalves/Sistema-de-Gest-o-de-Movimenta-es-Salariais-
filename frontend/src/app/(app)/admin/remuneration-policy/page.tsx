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
import { RemunerationPolicy } from "@/types";

type FormState = {
  maxMeritPercent: number | "";
  maxPromotionPercent: number | "";
  minMonthsBetweenRaises: number | "";
};

const EMPTY_FORM: FormState = { maxMeritPercent: "", maxPromotionPercent: "", minMonthsBetweenRaises: "" };

export default function RemunerationPolicyAdminPage() {
  return (
    <RoleGuard roles={["ADMIN", "RH_REMUNERACAO"]}>
      <RemunerationPolicyAdminContent />
    </RoleGuard>
  );
}

function RemunerationPolicyAdminContent() {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<RemunerationPolicy>("/remuneration-policy");
      setForm({
        maxMeritPercent: res?.maxMeritPercent ?? "",
        maxPromotionPercent: res?.maxPromotionPercent ?? "",
        minMonthsBetweenRaises: res?.minMonthsBetweenRaises ?? "",
      });
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        maxMeritPercent: form.maxMeritPercent === "" ? null : Number(form.maxMeritPercent),
        maxPromotionPercent: form.maxPromotionPercent === "" ? null : Number(form.maxPromotionPercent),
        minMonthsBetweenRaises: form.minMonthsBetweenRaises === "" ? null : Number(form.minMonthsBetweenRaises),
      };
      const res = await api.put<RemunerationPolicy>("/remuneration-policy", payload);
      setForm({
        maxMeritPercent: res?.maxMeritPercent ?? "",
        maxPromotionPercent: res?.maxPromotionPercent ?? "",
        minMonthsBetweenRaises: res?.minMonthsBetweenRaises ?? "",
      });
      showToast("Política de Remuneração salva com sucesso.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Política de Remuneração</h1>
        <p className="text-sm text-brand-text">
          Limites de referência para simulações e solicitações de Mérito e Promoção. Deixar um campo em branco
          significa que ele não tem limite. Violar um limite nunca bloqueia a simulação ou a submissão — o sistema
          apenas sinaliza, tanto para quem está simulando/solicitando quanto para quem vai aprovar, que a
          movimentação está fora da política.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-4 sm:max-w-sm">
            <Input
              label="% Máximo de Reajuste — Mérito"
              type="number"
              step="0.01"
              min={0}
              value={form.maxMeritPercent}
              onChange={(e) => setForm((f) => ({ ...f, maxMeritPercent: e.target.value === "" ? "" : Number(e.target.value) }))}
              hint="Em branco = sem limite."
            />
            <Input
              label="% Máximo de Reajuste — Promoção"
              type="number"
              step="0.01"
              min={0}
              value={form.maxPromotionPercent}
              onChange={(e) => setForm((f) => ({ ...f, maxPromotionPercent: e.target.value === "" ? "" : Number(e.target.value) }))}
              hint="Em branco = sem limite."
            />
            <Input
              label="Meses mínimos para reajuste"
              type="number"
              step="1"
              min={0}
              value={form.minMonthsBetweenRaises}
              onChange={(e) => setForm((f) => ({ ...f, minMonthsBetweenRaises: e.target.value === "" ? "" : Number(e.target.value) }))}
              hint="Tempo mínimo, em meses, desde o último reajuste (Mérito ou Promoção) do colaborador. Em branco = sem limite."
            />
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          Salvar política
        </Button>
      </div>
    </div>
  );
}
