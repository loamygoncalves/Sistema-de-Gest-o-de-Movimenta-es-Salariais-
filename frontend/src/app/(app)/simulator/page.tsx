"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { EmployeePicker } from "@/components/shared/EmployeePicker";
import { SimulationPanel } from "@/components/shared/SimulationPanel";
import { usePositions } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { normalizeSimulation } from "@/lib/normalize";
import { useToast } from "@/lib/toast";
import { Employee, MovementSimulation } from "@/types";

type QuickType = "PROMOCAO" | "MERITO";

// Mostra o salário atual e, assim que um novo salário válido é digitado, o
// % de reajuste que ele representa — usado por Promoção e Mérito (ambos
// partem do novo salário; o % de mérito é calculado a partir dele).
function reajusteHint(employee: Employee | null, newSalaryStr: string): string | undefined {
  if (!employee) return undefined;
  const current = employee.currentSalary;
  const currentFormatted = current.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const newSalary = Number(newSalaryStr);
  if (newSalaryStr && !Number.isNaN(newSalary) && current > 0) {
    const percent = ((newSalary - current) / current) * 100;
    const sign = percent >= 0 ? "+" : "";
    return `Salário atual: ${currentFormatted} (${sign}${percent.toFixed(2)}% de reajuste)`;
  }
  return `Salário atual: ${currentFormatted}`;
}

export default function SimulatorPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { positions } = usePositions();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [type, setType] = useState<QuickType>("PROMOCAO");
  const [newPositionId, setNewPositionId] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<MovementSimulation | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!employee) next.employee = "Selecione o colaborador.";
    if (!effectiveDate) next.effectiveDate = "Informe a data efetiva.";

    if (type === "PROMOCAO") {
      if (!newPositionId) next.newPositionId = "Selecione o novo cargo.";
      if (!newSalary) next.newSalary = "Informe o novo salário.";
      if (employee && newSalary && Number(newSalary) < employee.currentSalary) {
        next.newSalary = `O novo salário não pode ser menor que o salário atual (${employee.currentSalary.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" }
        )}).`;
      }
    } else {
      if (!newSalary) next.newSalary = "Informe o novo salário.";
      if (employee && newSalary && Number(newSalary) <= employee.currentSalary) {
        next.newSalary = `O novo salário precisa ser maior que o salário atual (${employee.currentSalary.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" }
        )}).`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSimulate() {
    if (!validate()) return;
    setSimulating(true);
    setSimulation(null);
    try {
      const payload =
        type === "PROMOCAO"
          ? {
              employeeId: employee!.id,
              type,
              newPositionId,
              newSalary: Number(newSalary),
              effectiveDate,
            }
          : {
              employeeId: employee!.id,
              type,
              newSalary: Number(newSalary),
              effectiveDate,
            };
      const res = await api.post<MovementSimulation>("/simulator/preview", payload);
      setSimulation(normalizeSimulation(res));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSimulating(false);
    }
  }

  function handleOpenRequest() {
    if (!employee) return;
    const params = new URLSearchParams({ employeeId: employee.id, type });
    if (newSalary) params.set("newSalary", newSalary);
    if (type === "PROMOCAO" && newPositionId) params.set("newPositionId", newPositionId);
    if (effectiveDate) params.set("effectiveDate", effectiveDate);
    router.push(`/movements/new?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Simulador Rápido</h1>
        <p className="text-sm text-brand-text">
          Teste o impacto de uma promoção ou mérito para um dos seus colaboradores e compare com o orçamento —
          antes de abrir a solicitação de movimentação de fato.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-5">
          <EmployeePicker value={employee} onChange={setEmployee} error={errors.employee} required />

          <Select
            label="Tipo de simulação"
            required
            options={[
              { value: "PROMOCAO", label: "Promoção" },
              { value: "MERITO", label: "Mérito" },
            ]}
            value={type}
            onChange={(e) => setType(e.target.value as QuickType)}
          />

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
                hint={reajusteHint(employee, newSalary)}
              />
            </div>
          )}

          {type === "MERITO" && (
            <Input
              label="Novo salário"
              type="number"
              step="0.01"
              required
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              error={errors.newSalary}
              hint={reajusteHint(employee, newSalary) ?? "O percentual de mérito é calculado automaticamente a partir do novo salário."}
            />
          )}

          <Input
            label="Data efetiva"
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            error={errors.effectiveDate}
          />

          <div>
            <Button onClick={handleSimulate} loading={simulating}>
              Simular
            </Button>
          </div>
        </div>
      </Card>

      {simulation && (
        <Card
          title="Resultado da simulação"
          actions={
            <Button size="sm" onClick={handleOpenRequest}>
              Abrir solicitação de movimentação
            </Button>
          }
        >
          <SimulationPanel simulation={simulation} />
        </Card>
      )}
    </div>
  );
}
