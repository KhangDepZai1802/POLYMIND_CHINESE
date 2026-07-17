"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { NavLinks } from "@/components/layout/nav-links";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getNavigation } from "@/lib/permissions/navigation";
import { ROLE_LABELS, type UserRole } from "@/types/roles";

/**
 * Điều hướng trên di động: nút hamburger ở header mở drawer chứa TOÀN BỘ module
 * của role (không giới hạn 5 mục như bottom nav cũ). Chỉ hiện dưới `md`.
 */
export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const items = getNavigation(role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 gap-0 p-0">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Logo size={40} />
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm font-semibold">
              POLYMIND
            </SheetTitle>
            <SheetDescription className="text-muted-foreground truncate text-xs">
              {ROLE_LABELS[role]}
            </SheetDescription>
          </div>
        </div>

        <nav
          aria-label="Điều hướng chính trên di động"
          className="flex-1 space-y-1 overflow-y-auto p-3"
        >
          <NavLinks items={items} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
