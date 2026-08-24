import React from "react";
import clsx from "@/lib/clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Card({ children, className, title, subtitle, actions }: CardProps) {
  return (
    <div className={clsx("rounded-xl border border-brand-border bg-white shadow-card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-brand-text">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
