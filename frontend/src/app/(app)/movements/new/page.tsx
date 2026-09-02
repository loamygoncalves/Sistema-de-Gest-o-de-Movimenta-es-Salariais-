"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmployeePicker } from "@/components/shared/EmployeePicker";
import { SalaryPercentInputs } from "@/components/shared/SalaryPercentInputs";
import { useCostCenters, useDirectorates, usePositions } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  CreateMovementPayload,
  Employee,
  MOVEMENT_TYPE_LABELS,
  MovementRequest,
  MovementType,
} from "@/types";

const TYPE_OPTIONS = Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function NewMovementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();
  const { costCenters } = useCostCenters();

  const [type, setType] = useState<MovementType>("PROMOCAO");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [newPositionId, setNewPositionId] = useState("");
  const [newSalary, setNewSalary] = useState<string>("");
  const [positionId, setPositionId] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [plannedSalary, setPlannedSalary] = useState<string>("");
  const [directorateId, setDirectorateId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [justification, setJustification] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pré-preenchimento vindo do Simulador Rápido (ver /simulator) — a pessoa
  // já simulou o impacto e quer abrir a solicitação real com os mesmos dados.
  useEffect(() => {
    const employeeId = searchParams.get("employeeId");
    const prefType = searchParams.get("type");
    if (prefType === "PROMOCAO" || prefType === "MERITO") setType(prefType);
    const prefNewPositionId = searchParams.get("newPositionId");
    if (prefNewPositionId) setNewPositionId(prefNewPositionId);
    const prefNewSalary = searchParams.get("newSalary");
    if (prefNewSalary) setNewSalary(prefNewSalary);
    const prefEffectiveDate = searchParams.get("effectiveDate");
    if (prefEffectiveDate) setEffectiveDate(prefEffectiveDate);

    if (employeeId) {
      api
        .get<Employee>(`/employees/${employeeId}`)
        .then(setEmployee)
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!effectiveDate) next.effectiveDate = "Informe a data efetiva.";
    if (!justification.trim()) next.justification = "Informe a justificativa.";

    if (type === "PROMOCAO") {
      if (!employee) next.employee = "Selecione o colaborador.";
      if (!newPositionId) next.newPositionId = "Selecione o novo cargo.";
      if (!newSalary) next.newSalary = "Informe o novo salário.";
      if (employee && newSalary && Number(newSalary) < employee.currentSalary) {
        next.newSalary = `O novo salário não pode ser menor que o salário atual (${employee.currentSalary.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" }
        )}).`;
      }
    }

    if (type === "MERITO") {
      if (!employee) next.employee = "Selecione o colaborador.";
      if (!newSalary) next.newSalary = "Informe o novo salário.";
      if (employee && newSalary && Number(newSalary) <= employee.currentSalary) {
        next.newSalary = `O novo salário precisa ser maior que o salário atual (${employee.currentSalary.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" }
        )}).`;
      }
    }

    if (type === "AUMENTO_QUADRO") {
      if (!positionId) next.positionId = "Selecione o cargo.";
      if (!quantity || Number(quantity) < 1) next.quantity = "Informe uma quantidade válida.";
      if (!plannedSalary) next.plannedSalary = "Informe o salário planejado.";
      if (!directorateId) next.directorateId = "Selecione a diretoria.";
      if (!costCenterId) next.costCenterId = "Selecione o centro de resultado.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    let payload: CreateMovementPayload | undefined;
    switch (type) {
      case "PROMOCAO":
        payload = {
          type,
          employeeId: employee!.id,
          newPositionId,
          newSalary: Number(newSalary),
          effectiveDate,
          justification,
        };
        break;
      case "MERITO":
        payload = {
          type,
          employeeId: employee!.id,
          newSalary: Number(newSalary),
          effectiveDate,
          justification,
        };
        break;
      case "AUMENTO_QUADRO":
        payload = {
          type,
          positionId,
          quantity: Number(quantity),
          plannedSalary: Number(plannedSalary),
          directorateId,
          costCenterId,
          effectiveDate,
          justification,
        };
        break;
    }

    if (!payload) return;

    setSubmitting(true);
    try {
      const created = await api.post<MovementRequest>("/movements", payload);
      showToast("Movimentação criada com sucesso.", "success");
      router.push(`/movements/${created.id}`);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Nova Movimentação</h1>
        <p className="text-sm text-brand-text">Preencha os dados de acordo com o tipo de movimentação.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select
            label="Tipo de movimentação"
            required
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
          />

          {(type === "PROMOCAO" || type === "MERITO") && (
            <EmployeePicker value={employee} onChange={setEmployee} error={errors.employee} required />
          )}

          {type === "PROMOCAO" && (
            <div className="flex flex-col gap-4">
              <Select
                label="Novo cargo"
                required
                placeholder="Selecione"
                options={positions.map((p) => ({ value: p.id, label: p.name }))}
                value={newPositionId}
                onChange={(e) => setNewPositionId(e.target.value)}
                error={errors.newPositionId}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SalaryPercentInputs currentSalary={employee?.currentSalary} newSalary={newSalary} onNewSalaryChange={setNewSalary} salaryError={errors.newSalary} />
              </div>
            </div>
          )}

          {type === "MERITO" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SalaryPercentInputs currentSalary={employee?.currentSalary} newSalary={newSalary} onNewSalaryChange={setNewSalary} salaryError={errors.newSalary} />
            </div>
          )}

          {type === "AUMENTO_QUADRO" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Cargo"
                required
                placeholder="Selecione"
                options={positions.map((p) => ({ value: p.id, label: p.name }))}
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                error={errors.positionId}
              />
              <Select
                label="Diretoria"
                required
                placeholder="Selecione"
                options={directorates.map((d) => ({ value: d.id, label: d.name }))}
                value={directorateId}
                onChange={(e) => setDirectorateId(e.target.value)}
                error={errors.directorateId}
              />
              <Select
                label="Centro de resultado"
                required
                placeholder="Selecione"
                options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                error={errors.costCenterId}
              />
              <Input
                label="Quantidade de vagas"
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                error={errors.quantity}
              />
              <Input
                label="Salário planejado"
                type="number"
                step="0.01"
                required
                value={plannedSalary}
                onChange={(e) => setPlannedSalary(e.target.value)}
                error={errors.plannedSalary}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Data efetiva"
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              error={errors.effectiveDate}
            />
          </div>

          <Textarea
            label="Justificativa"
            required
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            error={errors.justification}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Criar movimentação
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
