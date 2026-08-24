import React from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
