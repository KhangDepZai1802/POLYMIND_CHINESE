import "server-only";

import {
  NOTIFICATION_TYPES,
  type NotificationItem,
  type NotificationPreference,
} from "@/features/notifications/types";
import { createClient } from "@/lib/supabase/server";

export async function getNotificationBellData(): Promise<{
  unreadCount: number;
}> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw new Error(`Không tải được số thông báo: ${error.message}`);
  return { unreadCount: count ?? 0 };
}

export async function getNotificationCenterData(): Promise<{
  notifications: NotificationItem[];
  preferences: NotificationPreference[];
}> {
  const supabase = await createClient();
  const [notificationResult, preferenceResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("notification_preferences").select("type, in_app_enabled"),
  ]);

  if (notificationResult.error) {
    throw new Error(
      `Không tải được thông báo: ${notificationResult.error.message}`,
    );
  }
  if (preferenceResult.error) {
    throw new Error(
      `Không tải được tùy chọn thông báo: ${preferenceResult.error.message}`,
    );
  }

  const saved = new Map(
    preferenceResult.data.map((item) => [item.type, item.in_app_enabled]),
  );

  return {
    notifications: notificationResult.data,
    preferences: NOTIFICATION_TYPES.map((type) => ({
      type,
      in_app_enabled: saved.get(type) ?? true,
    })),
  };
}
