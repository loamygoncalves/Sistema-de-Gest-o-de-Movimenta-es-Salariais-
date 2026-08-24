"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmployeePicker } from "@/components/shared/EmployeePicker";
import { useDirectorates, usePositions } from "@/hooks/useOrgOptions";
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
  const { showToast } = useToast();
  const { directorates } = useDirectorates();
  const { positions } = usePositions();

  const [type, setType] = useState<MovementType>("PROMOCAO");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [newPositionId, setNewPositionId] = useState("");
  const [newSalary, setNewSalary] = useState<string>("");
  const [percentage, setPercentage] = useState<string>("");
  const [positionId, setPositionId] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [plannedSalary, setPlannedSalary] = useState<string>("");
  const [directorateId, setDirectorateId] = useState("");
  const [originDirectorateId, setOriginDirectorateId] = useState("");
  const [destinationDirectorateId, setDestinationDirectorateId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [justification, setJustification] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
      if (!percentage) next.percentage = "Informe o percentual de aumento.";
      if (percentage && Number(percentage) <= 0) next.percentage = "O percentual deve ser maior que zero.";
    }

    if (type === "AUMENTO_QUADRO") {
      if (!positionId) next.positionId = "Selecione o cargo.";
      if (!quantity || Number(quantity) < 1) next.quantity = "Informe uma quantidade válida.";
      if (!plannedSalary) next.plannedSalary = "Informe o salário planejado.";
      if (!directorateId) next.directorateId = "Selecione a diretoria.";
    }

    if (type === "TRANSFERENCIA") {
      if (!employee) next.employee = "Selecione o colaborador.";
      if (!originDirectorateId) next.originDirectorateId = "Selecione a diretoria de origem.";
      if (!destinationDirectorateId) next.destinationDirectorateId = "Selecione a diretoria de destino.";
      if (originDirectorateId && destinationDirectorateId && originDirectorateId === destinationDirectorateId) {
        next.destinationDirectorateId = "A diretoria de destino deve ser diferente da origem.";
      }
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
          percentage: Number(percentage),
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
          effectiveDate,
          justification,
        };
        break;
      case "TRANSFERENCIA":
        payload = {
          type,
          employeeId: employee!.id,
          originDirectorateId,
          destinationDirectorateId,
          newPositionId: newPositionId || undefined,
          newSalary: newSalary ? Number(newSalary) : undefined,
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
        <p className="text-sm text-slate-500">Preencha os dados de acordo com o tipo de movimentação.</p>
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

          {(type === "PROMOCAO" || type === "MERITO" || type === "TRANSFERENCIA") && (
            <EmployeePicker value={employee} onChange={setEmployee} error={errors.employee} required />
          )}

          {type === "PROMOCAO" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Novo cargo"
                required
                placeholder="Selecione"
                options={positions.map((p) => ({ value: p.id, label: p.name }))}
                value={newPositionId}
                onChange={(e) => setNewPositionId(e.target.value)}
                error={errors.newPositionId}
              />
              <Input
                label="Novo salário"
                type="number"
                step="0.01"
                required
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                error={errors.newSalary}
                hint={employee ? `Salário atual: ${employee.currentSalary.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : undefined}
              />
            </div>
          )}

          {type === "MERITO" && (
            <Input
              label="Percentual de aumento (%)"
              type="number"
              step="0.01"
              required
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              error={errors.percentage}
              hint="O valor do reajuste será calculado automaticamente pelo backend."
            />
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

          {type === "TRANSFERENCIA" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Diretoria de origem"
                required
                placeholder="Selecione"
                options={directorates.map((d) => ({ value: d.id, label: d.name }))}
                value={originDirectorateId}
                onChange={(e) => setOriginDirectorateId(e.target.value)}
                error={errors.originDirectorateId}
              />
              <Select
                label="Diretoria de destino"
                required
                placeholder="Selecione"
                options={directorates.map((d) => ({ value: d.id, label: d.name }))}
                value={destinationDirectorateId}
                onChange={(e) => setDestinationDirectorateId(e.target.value)}
                error={errors.destinationDirectorateId}
              />
              <Select
                label="Novo cargo (opcional)"
                placeholder="Manter cargo atual"
                options={positions.map((p) => ({ value: p.id, label: p.name }))}
                value={newPositionId}
                onChange={(e) => setNewPositionId(e.target.value)}
              />
              <Input
                label="Novo salário (opcional)"
                type="number"
                step="0.01"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
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
