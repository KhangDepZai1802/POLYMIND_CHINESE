import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ScrollableNav } from "@/components/shared/scrollable-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementManager } from "@/features/announcements/components/announcement-manager";
import {
  getAnnouncementClassOptions,
  getAnnouncements,
} from "@/features/announcements/server/queries";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { getNotificationCenterData } from "@/features/notifications/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thông báo" };

export default async function AdminNotificationsPage() {
  await requireRole("super_admin");
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
      <Tabs defaultValue="announcements" className="space-y-4">
        {/* Cùng khuôn với `/admin/courses/[id]`: dải tab cuộn ngang được và tới
            được bằng bàn phím, để hai màn Quản trị không lệch nhau. */}
        <ScrollableNav label="Nhóm thông báo">
          <TabsList className="min-w-max">
            <TabsTrigger value="announcements">Thông báo chung</TabsTrigger>
            <TabsTrigger value="notifications">Thông báo của tôi</TabsTrigger>
          </TabsList>
        </ScrollableNav>
        <TabsContent value="announcements">
          <AnnouncementManager
            announcements={announcements}
            classes={classes}
          />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationCenter {...notificationData} role="super_admin" />
        </TabsContent>
      </Tabs>
    </>
  );
}
