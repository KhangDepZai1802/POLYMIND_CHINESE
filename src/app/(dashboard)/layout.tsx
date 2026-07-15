import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/shared/logo";
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
  const user = await requireUser();
  const { unreadCount } = await getNotificationBellData();

  return (
    <div className="bg-muted/30 flex min-h-screen">
      <a
        href="#noi-dung-chinh"
        className="bg-background text-foreground focus:ring-ring fixed top-2 left-2 z-50 -translate-y-20 rounded-md px-4 py-3 font-medium shadow-lg focus:translate-y-0 focus:ring-2 focus:outline-none"
      >
        Bỏ qua điều hướng
      </a>
      <SidebarNav role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={32} radius="rounded-lg" priority />
            <span className="text-sm font-semibold">POLYMIND</span>
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

        <main id="noi-dung-chinh" tabIndex={-1} className="flex-1 p-4 md:p-6">
          {children}
        </main>

        {/* pb-20 chừa chỗ cho bottom nav trên mobile */}
        <SiteFooter className="border-t pb-20 md:pb-6" />
      </div>

      <BottomNav role={user.role} />
      <Toaster position="top-center" richColors />
    </div>
  );
}
