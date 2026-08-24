"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "@/lib/clsx";
import { useAuth } from "@/lib/auth";
import { NAV_GROUPS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          SG
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-800">SGMS</p>
          <p className="text-[11px] leading-tight text-slate-400">Movimentações Salariais</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || (user && hasRole(...item.roles))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
