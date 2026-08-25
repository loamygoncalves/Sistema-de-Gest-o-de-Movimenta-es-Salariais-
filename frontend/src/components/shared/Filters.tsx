"use client";

import React, { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/Input";
import { Directorate, FULL_MONTH_LABELS } from "@/types";

export function yearOptions(range = 5): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  const years: { value: string; label: string }[] = [];
  for (let y = current + 1; y >= current - range; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
  label?: string;
}

export function YearSelect({ value, onChange, label = "Ano" }: YearSelectProps) {
  return (
    <Select
      label={label}
      options={yearOptions()}
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

const MONTH_OPTIONS = Object.entries(FULL_MONTH_LABELS).map(([value, label]) => ({ value, label }));

interface MonthSelectProps {
  value: number;
  onChange: (month: number) => void;
  label?: string;
}

export function MonthSelect({ value, onChange, label = "Mês" }: MonthSelectProps) {
  return (
    <Select
      label={label}
      options={MONTH_OPTIONS}
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

const MONTH_MULTI_OPTIONS = Object.entries(FULL_MONTH_LABELS) as [string, string][];

interface MonthMultiSelectProps {
  value: number[];
  onChange: (months: number[]) => void;
  label?: string;
}

/**
 * Seletor de vários meses (chips + painel com checkboxes) para o Dashboard
 * Executivo: o usuário escolhe exatamente quais meses quer analisar — de um
 * único mês a "Ano todo" — e o dashboard reflete só o que está selecionado
 * (soma para custo, média para headcount — ver types/dashboard.ts).
 */
export function MonthMultiSelect({ value, onChange, label = "Meses" }: MonthMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(month: number) {
    const next = value.includes(month) ? value.filter((m) => m !== month) : [...value, month].sort((a, b) => a - b);
    onChange(next.length > 0 ? next : [month]);
  }

  const summary =
    value.length === 12
      ? "Ano todo"
      : value.length === 1
        ? FULL_MONTH_LABELS[value[0]]
        : `${value.length} meses selecionados`;

  return (
    <div className="relative" ref={ref}>
      <span className="mb-1 block text-xs font-medium text-brand-text">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-48 items-center justify-between rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-slate-900 hover:border-brand-teal focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
      >
        <span className="truncate">{summary}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-brand-border bg-white p-2 shadow-lg">
          <div className="mb-2 flex gap-2 border-b border-brand-border pb-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-bg"
              onClick={() => onChange(Array.from({ length: 12 }, (_, i) => i + 1))}
            >
              Ano todo
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-bg"
              onClick={() => onChange([new Date().getMonth() + 1])}
            >
              Só mês atual
            </button>
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            {MONTH_MULTI_OPTIONS.map(([monthStr, label2]) => {
              const month = Number(monthStr);
              return (
                <label
                  key={month}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-brand-bg"
                >
                  <input type="checkbox" checked={value.includes(month)} onChange={() => toggle(month)} />
                  <span>{label2}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface DirectorateSelectProps {
  value: string;
  onChange: (value: string) => void;
  directorates: Directorate[];
  label?: string;
  allowAll?: boolean;
}

export function DirectorateSelect({
  value,
  onChange,
  directorates,
  label = "Diretoria",
  allowAll = true,
}: DirectorateSelectProps) {
  return (
    <Select
      label={label}
      placeholder={allowAll ? "Todas as diretorias" : undefined}
      options={directorates.map((d) => ({ value: d.id, label: d.name }))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
