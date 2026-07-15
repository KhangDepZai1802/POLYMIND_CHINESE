"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notificationPathForRole } from "@/features/notifications/links";
import { NOTIFICATION_TYPES } from "@/features/notifications/types";
import { dbErrorToMessage, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const notificationIdSchema = z.string().uuid();

function revalidateNotificationViews(
  role: Awaited<ReturnType<typeof requireUser>>["role"],
) {
  revalidatePath(notificationPathForRole(role));
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = notificationIdSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Mã thông báo không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (error) return { error: dbErrorToMessage(error) };
  revalidateNotificationViews(user.role);
  return { success: "Đã đánh dấu thông báo là đã đọc." };
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { error: dbErrorToMessage(error) };
  revalidateNotificationViews(user.role);
  return { success: "Đã đánh dấu tất cả thông báo là đã đọc." };
}

export async function saveNotificationPreferencesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const rows = NOTIFICATION_TYPES.map((type) => ({
    user_id: user.id,
    type,
    in_app_enabled: formData.get(type) === "on",
    email_enabled: false,
  }));

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,type" });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateNotificationViews(user.role);
  return { success: "Đã lưu tùy chọn thông báo." };
}
