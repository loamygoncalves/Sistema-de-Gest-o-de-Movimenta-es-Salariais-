import React from "react";
import clsx from "@/lib/clsx";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  tone?: "default" | "success" | "danger" | "warning";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-slate-900",
  success: "text-emerald-600",
  danger: "text-red-600",
  warning: "text-amber-600",
};

export function KpiCard({ label, value, hint, trend, trendLabel, tone = "default", className }: KpiCardProps) {
  return (
    <div className={clsx("rounded-xl border border-brand-border bg-white p-4 shadow-card", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-text">{label}</p>
      <p className={clsx("mt-2 text-2xl font-semibold", TONE_CLASSES[tone])}>{value}</p>
      {(hint || trendLabel) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-brand-text">
          {trend && (
            <span
              className={clsx(
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-red-600",
                trend === "neutral" && "text-slate-400"
              )}
            >
              {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"}
            </span>
          )}
          <span>{trendLabel ?? hint}</span>
        </div>
      )}
    </div>
  );
}
