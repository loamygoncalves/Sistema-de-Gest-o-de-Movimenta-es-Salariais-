"use client";

import React, { useState } from "react";
import Image from "next/image";
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
    <div className="flex min-h-screen bg-brand-bg">
      {/* Brand panel — dark teal gradient, white logo (wordmark stays legible) */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-brand-teal-dark via-brand-teal-dark to-brand-teal px-10 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-teal-light/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-teal-light/10 blur-3xl" />
        <Image
          src="/beep-logo-white.png"
          alt="Beep Saúde"
          width={3981}
          height={1169}
          priority
          className="h-16 w-auto"
        />
        <p className="max-w-sm text-center text-sm text-white/80">
          Sistema de Gestão de Movimentações Salariais — headcount, folha e aprovações em um só
          lugar.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-4 lg:w-1/2">
        <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-card">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/beep-logo-color.png"
              alt="Beep Saúde"
              width={1920}
              height={1080}
              priority
              className="mb-4 h-14 w-auto lg:hidden"
            />
            <h1 className="text-lg font-semibold text-slate-900">SGMS</h1>
            <p className="text-sm text-brand-text">Sistema de Gestão de Movimentações Salariais</p>
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
    </div>
  );
}
