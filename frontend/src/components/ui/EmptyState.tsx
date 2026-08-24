import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
