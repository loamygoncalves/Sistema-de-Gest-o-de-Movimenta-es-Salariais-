"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";

/**
 * Par de campos "Novo salário" / "Percentual de reajuste (%)" que se
 * atualizam um ao outro a partir do salário atual do colaborador — o
 * usuário preenche qualquer um dos dois, o outro é calculado automaticamente.
 * `newSalary` continua sendo a única fonte de verdade lida pelo componente
 * pai (validação/payload) — o percentual é só uma forma alternativa de
 * preenchê-lo. Recebe `currentSalary` como número solto (em vez do
 * Employee inteiro) para servir tanto o formulário de nova movimentação
 * (tem o Employee completo) quanto a edição de uma movimentação existente
 * (só tem `movement.currentSalary`).
 */
export function SalaryPercentInputs({
  currentSalary,
  newSalary,
  onNewSalaryChange,
  salaryLabel = "Novo salário",
  salaryError,
}: {
  currentSalary: number | null | undefined;
  newSalary: string;
  onNewSalaryChange: (value: string) => void;
  salaryLabel?: string;
  salaryError?: string;
}) {
  const [percent, setPercent] = useState("");
  const lastEditedRef = useRef<"salary" | "percent" | null>(null);

  useEffect(() => {
    if (lastEditedRef.current === "percent") {
      lastEditedRef.current = null;
      return;
    }
    if (!currentSalary || currentSalary <= 0 || !newSalary) {
      setPercent("");
      return;
    }
    const value = Number(newSalary);
    if (Number.isNaN(value)) return;
    setPercent((((value - currentSalary) / currentSalary) * 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSalary, currentSalary]);

  function handleSalaryChange(value: string) {
    lastEditedRef.current = "salary";
    onNewSalaryChange(value);
  }

  function handlePercentChange(value: string) {
    lastEditedRef.current = "percent";
    setPercent(value);
    if (!currentSalary || currentSalary <= 0 || value === "") {
      if (value === "") onNewSalaryChange("");
      return;
    }
    const percentValue = Number(value);
    if (Number.isNaN(percentValue)) return;
    onNewSalaryChange((currentSalary * (1 + percentValue / 100)).toFixed(2));
  }

  const currentFormatted = currentSalary
    ? currentSalary.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : undefined;

  return (
    <>
      <Input
        label={salaryLabel}
        type="number"
        step="0.01"
        required
        value={newSalary}
        onChange={(e) => handleSalaryChange(e.target.value)}
        error={salaryError}
        hint={currentFormatted ? `Salário atual: ${currentFormatted}` : undefined}
      />
      <Input
        label="Percentual de reajuste (%)"
        type="number"
        step="0.01"
        value={percent}
        onChange={(e) => handlePercentChange(e.target.value)}
        hint="Preencha um dos dois campos — o outro é calculado automaticamente."
      />
    </>
  );
}
