import Link from "next/link";
import { ScrollText, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "accounts", label: "Quản trị", href: "/admin/system?tab=accounts", icon: Users },
  { key: "audit", label: "Nhật ký audit", href: "/admin/system?tab=audit", icon: ScrollText },
] as const;

export type SystemTab = (typeof TABS)[number]["key"];

/** Hai nút chuyển giữa quản lý tài khoản và nhật ký audit. */
export function SystemTabs({ active }: { active: SystemTab }) {
  return (
    <div
      role="tablist"
      aria-label="Khu vực quản trị"
      className="bg-muted mb-6 inline-flex gap-1 rounded-lg p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
