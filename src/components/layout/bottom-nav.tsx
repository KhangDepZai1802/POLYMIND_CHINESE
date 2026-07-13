"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getMobileNavigation,
  isNavItemActive,
} from "@/lib/permissions/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";

/**
 * Điều hướng đáy màn hình cho mobile.
 *
 * Giáo viên dùng app này trên điện thoại giữa buổi dạy — mục tiêu bấm phải đủ
 * lớn (≥ 44px, xem `globals.css`) và tối đa 5 mục. Nhiều hơn là không bấm trúng.
 */
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getMobileNavigation(role);

  return (
    <nav className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full truncate leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
