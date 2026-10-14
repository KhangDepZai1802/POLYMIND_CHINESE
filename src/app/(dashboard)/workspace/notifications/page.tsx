import type { Metadata } from "next";
import { NotificationPage } from "@/features/notifications/components/notification-page";
import { requireRole } from "@/lib/auth/session";
import { BUSINESS_ROLES } from "@/types/roles";

export const metadata: Metadata = { title: "Thông báo" };
export default async function WorkspaceNotificationsPage() {
  const user = await requireRole(...BUSINESS_ROLES);
  return <NotificationPage role={user.role} />;
}
