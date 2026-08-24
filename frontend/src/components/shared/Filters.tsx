"use client";

import React from "react";
import { Select } from "@/components/ui/Input";
import { Directorate } from "@/types";

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
