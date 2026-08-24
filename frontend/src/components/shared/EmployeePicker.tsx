"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Employee, Paginated } from "@/types";
import { formatCurrency } from "@/lib/format";
import { FieldWrapper } from "@/components/ui/Input";
import clsx from "@/lib/clsx";

interface EmployeePickerProps {
  label?: string;
  required?: boolean;
  error?: string;
  value: Employee | null;
  onChange: (employee: Employee | null) => void;
  directorateId?: string; // optional scope filter
}

export function EmployeePicker({ label = "Colaborador", required, error, value, onChange, directorateId }: EmployeePickerProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      api
        .get<Paginated<Employee>>("/employees", {
          search: query || undefined,
          directorateId: directorateId || undefined,
          page: 1,
          limit: 8,
        })
        .then((res) => setResults(res.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, directorateId]);

  return (
    <div className="relative">
      <FieldWrapper label={label} required={required} error={error}>
        <input
          className={clsx(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
            error && "border-red-400"
          )}
          placeholder="Busque por nome ou matrícula..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </FieldWrapper>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Nenhum colaborador encontrado.</div>
          )}
          {!loading &&
            results.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={() => {
                  onChange(emp);
                  setQuery(emp.name);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-slate-800">{emp.name}</span>
                <span className="text-xs text-slate-400">
                  {emp.positionName ?? "—"} · {emp.directorateName ?? "—"} · {formatCurrency(emp.currentSalary)}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
