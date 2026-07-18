"use client";

import { Logo } from "@/components/shared/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { getNavigation } from "@/lib/permissions/navigation";
import { ROLE_LABELS, type UserRole } from "@/types/roles";

// Client island: `getNavigation` trả về NavItem có `icon` là component
// (forwardRef). Nếu SidebarNav là Server Component thì việc truyền `items` sang
// client `NavLinks` sẽ ném "Functions cannot be passed to Client Components"
// (chỉ lộ ở prod build). Chạy client như MobileNav để icon không vượt ranh giới.
export function SidebarNav({ role }: { role: UserRole }) {
  const items = getNavigation(role);

  return (
    <aside className="bg-card sticky top-0 hidden h-svh w-64 shrink-0 flex-col self-start border-r md:flex">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <Logo size={40} priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">POLYMIND</p>
          {/* Điểm nhấn cam thương hiệu — dùng tiết chế bên cạnh xanh chủ đạo. */}
          <span
            className="bg-brand-orange my-1 block h-0.5 w-6 rounded-full"
            aria-hidden
          />
          <p className="text-muted-foreground truncate text-xs">
            {ROLE_LABELS[role]}
          </p>
        </div>
      </div>

      <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavLinks items={items} />
      </nav>
    </aside>
  );
}
