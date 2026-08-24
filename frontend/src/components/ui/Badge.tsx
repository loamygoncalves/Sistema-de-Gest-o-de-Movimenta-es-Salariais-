import React from "react";
import clsx from "@/lib/clsx";

type BadgeColor = "slate" | "green" | "red" | "amber" | "blue" | "indigo";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-brand-100 text-brand-700",
};

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

export function Badge({ children, color = "slate", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR_CLASSES[color],
        className
      )}
    >
      {children}
    </span>
  );
}
