import React from "react";
import clsx from "@/lib/clsx";

type BadgeColor = "slate" | "green" | "red" | "amber" | "blue" | "teal";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  slate: "bg-brand-bg text-brand-text",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  // Alerta/pendente: laranja Beep (nunca como fundo grande, só tons suaves em badges)
  amber: "bg-brand-orange/15 text-amber-800",
  blue: "bg-blue-100 text-blue-700",
  teal: "bg-brand-teal/15 text-brand-teal-dark",
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
