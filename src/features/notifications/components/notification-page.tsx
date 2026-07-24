import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementFeed } from "@/features/announcements/components/announcement-feed";
import { getAnnouncements } from "@/features/announcements/server/queries";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { getNotificationCenterData } from "@/features/notifications/server/queries";
import type { UserRole } from "@/types/roles";

export async function NotificationPage({ role }: { role: UserRole }) {
  const [data, announcements] = await Promise.all([
    getNotificationCenterData(),
    getAnnouncements(),
  ]);

  return (
    <>
      <PageHeader
        title="Thông báo"
        description="Thông báo chung liên quan, cập nhật dành riêng cho tài khoản và tùy chọn nhận thông báo trong ứng dụng."
      />
      <AnnouncementFeed announcements={announcements} />
      <NotificationCenter {...data} role={role} />
    </>
  );
}
