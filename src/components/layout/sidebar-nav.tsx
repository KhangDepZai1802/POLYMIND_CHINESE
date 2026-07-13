"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import {
  getNavigation,
  isNavItemActive,
} from "@/lib/permissions/navigation";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type UserRole } from "@/types/roles";

export function SidebarNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getNavigation(role);

  return (
    <aside className="bg-card hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <Logo size={40} priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">POLYMIND</p>
          <p className="text-muted-foreground truncate text-xs">
            {ROLE_LABELS[role]}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
