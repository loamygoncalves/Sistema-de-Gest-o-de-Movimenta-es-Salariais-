import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { ToastViewport } from "@/components/ui/ToastViewport";

export const metadata: Metadata = {
  title: "SGMS — Sistema de Gestão de Movimentações Salariais",
  description: "Gestão de movimentações salariais, orçamento de folha e aprovações.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <AuthProvider>
            {children}
            <ToastViewport />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
