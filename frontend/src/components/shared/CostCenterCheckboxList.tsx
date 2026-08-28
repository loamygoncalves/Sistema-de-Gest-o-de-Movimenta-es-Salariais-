"use client";

import React from "react";
import { useCostCenters } from "@/hooks/useOrgOptions";

export function CostCenterCheckboxList({
  selectedIds,
  onChange,
  label = "Centros de resultado",
  hint,
  required = true,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  hint?: string;
  required?: boolean;
}) {
  const { costCenters } = useCostCenters();

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-brand-text">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-brand-border p-2">
        {costCenters.length === 0 && <p className="p-2 text-sm text-slate-400">Nenhum centro de resultado cadastrado.</p>}
        {costCenters.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brand-bg">
            <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}</span>
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
