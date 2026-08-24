"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageLoading } from "@/components/ui/Spinner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  if (loading || !token || !user) {
    return <PageLoading />;
  }

  return <>{children}</>;
}
