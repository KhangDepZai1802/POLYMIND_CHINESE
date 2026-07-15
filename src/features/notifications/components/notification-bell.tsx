import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notificationPathForRole } from "@/features/notifications/links";
import type { UserRole } from "@/types/roles";

export function NotificationBell({
  role,
  unreadCount,
}: {
  role: UserRole;
  unreadCount: number;
}) {
  return (
    <Button asChild size="icon" variant="ghost" className="relative">
      <Link
        href={notificationPathForRole(role)}
        aria-label={
          unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Thông báo"
        }
      >
        <Bell aria-hidden />
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
