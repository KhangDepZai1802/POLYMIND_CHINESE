import type { Metadata } from "next";

import { NotificationPage } from "@/features/notifications/components/notification-page";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thông báo" };

export default async function StudentNotificationsPage() {
  await requireRole("student");
  return <NotificationPage role="student" />;
}
