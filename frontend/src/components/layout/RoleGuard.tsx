"use client";

import React from "react";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

export function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Você não tem permissão para visualizar esta página."
      />
    );
  }

  return <>{children}</>;
}
