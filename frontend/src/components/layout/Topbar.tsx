"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/types";

export function Topbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="md:hidden text-sm font-semibold text-slate-800">SGMS</div>
      <div className="hidden md:block" />
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium leading-tight text-slate-800">{user?.name ?? "—"}</p>
            <p className="text-xs leading-tight text-slate-400">
              {user ? ROLE_LABELS[user.role] : ""}
            </p>
          </div>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              onClick={logout}
              className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
