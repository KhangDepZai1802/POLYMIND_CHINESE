import type { Metadata } from "next";

import { NotificationPage } from "@/features/notifications/components/notification-page";
import { requireTeaching } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thông báo" };

export default async function TeacherNotificationsPage() {
  await requireTeaching();
  return <NotificationPage role="teacher" />;
}
