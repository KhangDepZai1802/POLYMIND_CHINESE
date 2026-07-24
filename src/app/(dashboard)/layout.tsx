import { Suspense } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/shared/logo";
import { NavProgress } from "@/components/shared/nav-progress";
import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { Toaster } from "@/components/ui/sonner";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotificationBellData } from "@/features/notifications/server/queries";
import { requireUser } from "@/lib/auth/session";

/**
 * Trang đã đăng nhập KHÔNG được cache/ISR.
 *
 * Cache một trang authenticated là rủi ro rò session: user B có thể nhận lại
 * HTML đã render cho user A.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, { unreadCount }] = await Promise.all([
    requireUser(),
    getNotificationBellData(),
  ]);

  return (
    <ConfirmationProvider>
      <div className="bg-surface-page flex min-h-screen" data-dashboard-shell>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <a
          href="#noi-dung-chinh"
          data-dashboard-chrome
          className="bg-background text-foreground focus:ring-ring fixed top-2 left-2 z-50 -translate-y-20 rounded-md px-4 py-3 font-medium shadow-lg focus:translate-y-0 focus:ring-2 focus:outline-none"
        >
          Bỏ qua điều hướng
        </a>
        <div className="contents" data-dashboard-chrome>
          <SidebarNav role={user.role} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="bg-card sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 md:px-6"
            data-dashboard-chrome
          >
            {/* Header di động cao 64px: logo 28px là mức lớn nhất còn chừa
                được lề thở trên dưới. Chữ "POLYMIND" rời đã bỏ — logo đã là
                chữ đó, để cả hai thì trên màn 360px không đủ chỗ cho chuông
                thông báo và menu người dùng bên phải. */}
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <MobileNav role={user.role} />
              <Logo height={28} priority />
            </div>

            <div className="hidden md:block" />

            <div className="flex items-center gap-1">
              <NotificationBell role={user.role} unreadCount={unreadCount} />
              <UserMenu
                fullName={user.fullName}
                email={user.email}
                role={user.role}
              />
            </div>
          </header>

          <main
            id="noi-dung-chinh"
            tabIndex={-1}
            className="flex-1 p-4 md:p-6"
            data-dashboard-main
          >
            {children}
          </main>

          <div className="contents" data-dashboard-chrome>
            <SiteFooter className="border-t pb-6" />
          </div>
        </div>

        <Toaster position="top-center" richColors />
      </div>
    </ConfirmationProvider>
  );
}
