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
          // Dùng --brand-red (accent thương hiệu) chứ không phải --destructive:
          // số thông báo chưa đọc là một con số đếm, không phải trạng thái lỗi.
          // Cùng sắc đỏ, chữ trắng trên #C8102E đạt 5.88:1.
          <span className="bg-brand-red text-brand-red-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-xs leading-4 font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
