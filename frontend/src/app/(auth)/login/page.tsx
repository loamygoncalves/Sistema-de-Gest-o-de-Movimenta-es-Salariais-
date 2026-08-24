"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/format";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            SG
          </div>
          <h1 className="text-lg font-semibold text-slate-900">SGMS</h1>
          <p className="text-sm text-slate-500">Sistema de Gestão de Movimentações Salariais</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="E-mail corporativo"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
          />
          <Input
            label="Senha"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
