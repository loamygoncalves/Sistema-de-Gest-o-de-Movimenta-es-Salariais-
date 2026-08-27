"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "@/lib/clsx";
import { useAuth } from "@/lib/auth";
import { NAV_GROUPS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-brand-border bg-white md:flex">
      <div className="flex h-24 flex-col justify-center gap-1.5 border-b-2 border-brand-teal/20 px-5">
        <Image
          src="/beep-logo-color.png"
          alt="Beep Saúde"
          width={1920}
          height={1080}
          priority
          className="h-11 w-auto"
        />
        <p className="text-sm font-semibold leading-tight text-brand-teal-dark">Movimentações Salariais</p>
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
                        "rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-brand-teal-light bg-brand-teal/10 text-brand-teal-dark"
                          : "border-transparent text-brand-text hover:bg-brand-bg hover:text-brand-teal-dark"
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
