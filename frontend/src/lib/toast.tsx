"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser usado dentro de um ToastProvider");
  }
  return ctx;
}
