"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PageLoading } from "@/components/ui/Spinner";
import { useAuth } from "@/lib/auth";
import { useDirectorates, usePositions, useCostCenters } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { Employee, EMPLOYEE_STATUS_LABELS, EmployeeStatus, UpdateEmployeePayload } from "@/types";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();
  const { costCenters } = useCostCenters();

  const canEdit = hasRole("ADMIN", "RH_REMUNERACAO");

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateEmployeePayload>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<Employee>(`/employees/${params.id}`)
      .then((res) => {
        if (!active) return;
        setEmployee(res);
        setForm({
          name: res.name,
          email: res.email,
          positionId: res.positionId,
          directorateId: res.directorateId,
          costCenterId: res.costCenterId,
          currentSalary: res.currentSalary,
          status: res.status,
        });
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.patch<Employee>(`/employees/${params.id}`, form);
      setEmployee(updated);
      showToast("Colaborador atualizado com sucesso.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!employee) return <p className="text-sm text-brand-text">Colaborador não encontrado.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="mb-1 text-xs text-slate-400 hover:text-brand-text">
            ← Voltar
          </button>
          <h1 className="text-xl font-semibold text-slate-900">{employee.name}</h1>
          <p className="text-sm text-brand-text">Matrícula {employee.registration ?? "—"}</p>
        </div>
      </div>

      <Card title="Dados cadastrais">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome"
            value={form.name ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Cargo"
            options={positions.map((p) => ({ value: p.id, label: p.name }))}
            value={form.positionId ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, positionId: e.target.value }))}
          />
          <Select
            label="Diretoria"
            options={directorates.map((d) => ({ value: d.id, label: d.name }))}
            value={form.directorateId ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, directorateId: e.target.value }))}
          />
          <Select
            label="Centro de Custo"
            options={costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            value={form.costCenterId ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, costCenterId: e.target.value }))}
          />
          <Input
            label="Salário Atual"
            type="number"
            step="0.01"
            value={form.currentSalary ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, currentSalary: Number(e.target.value) }))}
          />
          <Select
            label="Status"
            options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={form.status ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EmployeeStatus }))}
          />
        </div>
        {canEdit && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Salvar alterações
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
