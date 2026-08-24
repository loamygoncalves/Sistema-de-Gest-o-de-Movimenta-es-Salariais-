"use client";

import React from "react";
import { useToast } from "@/lib/toast";
import clsx from "@/lib/clsx";

const VARIANT_CLASSES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-800",
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "flex items-start justify-between gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg",
            VARIANT_CLASSES[toast.variant]
          )}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100"
            aria-label="Fechar notificação"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
