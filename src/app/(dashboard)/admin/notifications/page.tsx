import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { AnnouncementManager } from "@/features/announcements/components/announcement-manager";
import {
  getAnnouncementClassOptions,
  getAnnouncements,
} from "@/features/announcements/server/queries";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { getNotificationCenterData } from "@/features/notifications/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thông báo" };

export default async function AdminNotificationsPage() {
  // 🔴 KHÔNG hardcode role xuống NotificationCenter. `role` ở đó quyết định
  // deep-link của từng thông báo được coi là hợp lệ hay bị loại
  // (`safeNotificationLink`). Đóng cứng "super_admin" thì thông báo của giáo vụ
  // trỏ `/teacher/...` bị vứt sạch — `GIAOVU-NOTIFY-004`, Codex 2026-08-03.
  const me = await requireManager();
  const [notificationData, announcements, classes] = await Promise.all([
    getNotificationCenterData(),
    getAnnouncements(),
    getAnnouncementClassOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Thông báo"
        description="Thông báo cá nhân và thông báo chung một chiều cho toàn hệ thống hoặc theo lớp."
      />
      {/* Cùng khuôn với `/admin/courses/[id]` để hai màn Quản trị không lệch
          nhau (`UX-MOBILE-1`). */}
      <ResponsiveTabs
        label="Nhóm thông báo"
        defaultValue="announcements"
        className="space-y-4"
        items={[
          { value: "announcements", label: "Thông báo chung" },
          { value: "notifications", label: "Thông báo của tôi" },
        ]}
      >
        <TabsContent value="announcements">
          <AnnouncementManager
            announcements={announcements}
            classes={classes}
          />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationCenter {...notificationData} role={me.role} />
        </TabsContent>
      </ResponsiveTabs>
    </>
  );
}
