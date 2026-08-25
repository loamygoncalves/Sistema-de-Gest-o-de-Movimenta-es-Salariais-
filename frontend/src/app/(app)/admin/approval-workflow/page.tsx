"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { APPROVAL_STEP_ROLE_LABELS, ApprovalStepRole, ApprovalWorkflowStep } from "@/types";

const ROLE_OPTIONS: ApprovalStepRole[] = ["ADMIN", "RH_REMUNERACAO", "DIRETOR"];

export default function ApprovalWorkflowAdminPage() {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <ApprovalWorkflowAdminContent />
    </RoleGuard>
  );
}

function ApprovalWorkflowAdminContent() {
  const { showToast } = useToast();
  const [steps, setSteps] = useState<ApprovalWorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApprovalWorkflowStep[]>("/approval-workflow");
      setSteps((res ?? []).sort((a, b) => a.stepOrder - b.stepOrder));
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

  function addStep() {
    setSteps((prev) => [...prev, { stepOrder: prev.length + 1, roles: [] }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleRole(index: number, role: ApprovalStepRole) {
    setSteps((prev) =>
      prev.map((step, i) =>
        i === index
          ? {
              ...step,
              roles: step.roles.includes(role) ? step.roles.filter((r) => r !== role) : [...step.roles, role],
            }
          : step
      )
    );
  }

  async function handleSave() {
    if (steps.length === 0) {
      showToast("O fluxo precisa ter ao menos uma etapa.", "error");
      return;
    }
    const emptyStep = steps.find((s) => s.roles.length === 0);
    if (emptyStep) {
      showToast("Toda etapa precisa de ao menos um perfil elegível.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { steps: steps.map((s) => ({ roles: s.roles })) };
      const res = await api.put<ApprovalWorkflowStep[]>("/approval-workflow", payload);
      setSteps((res ?? []).sort((a, b) => a.stepOrder - b.stepOrder));
      showToast("Fluxo de aprovação salvo com sucesso.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Fluxo de Aprovação</h1>
        <p className="text-sm text-brand-text">
          Defina as etapas do fluxo, em ordem. Em cada etapa, qualquer um dos perfis selecionados pode aprovar ou
          reprovar — vale quem agir primeiro. A movimentação só é considerada aprovada depois que todas as etapas
          forem concluídas. GESTOR nunca aprova, apenas solicita.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-4">
            {steps.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma etapa configurada. Adicione ao menos uma.</p>
            )}
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-lg border border-brand-border p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-1 flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-800">Etapa {index + 1}</span>
                  <div className="flex flex-wrap gap-4">
                    {ROLE_OPTIONS.map((role) => (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step.roles.includes(role)}
                          onChange={() => toggleRole(index, role)}
                        />
                        <span>{APPROVAL_STEP_ROLE_LABELS[role]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={index === 0} onClick={() => moveStep(index, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="outline" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => removeStep(index)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button variant="outline" onClick={addStep}>
                Adicionar etapa
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          Salvar fluxo
        </Button>
      </div>
    </div>
  );
}
