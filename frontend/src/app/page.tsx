"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageLoading } from "@/components/ui/Spinner";

export default function RootPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [loading, token, router]);

  return <PageLoading />;
}
