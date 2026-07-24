"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { announcementSchema } from "@/features/announcements/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

function revalidateAnnouncementViews() {
  revalidatePath("/admin/notifications");
  revalidatePath("/teacher/notifications");
  revalidatePath("/student/notifications");
  revalidatePath("/", "layout");
}

export async function saveAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_announcement", {
    p_announcement_id: parsed.data.announcement_id ?? undefined,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_class_id: parsed.data.class_id ?? undefined,
    p_expires_at: parsed.data.expires_at
      ? fromLocalInput(parsed.data.expires_at).toISOString()
      : undefined,
  });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateAnnouncementViews();
  return {
    success: parsed.data.announcement_id
      ? "Đã cập nhật bản nháp."
      : "Đã tạo bản nháp thông báo chung.",
  };
}

export async function publishAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Mã thông báo chung không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_announcement", {
    p_announcement_id: parsed.data,
  });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateAnnouncementViews();
  return { success: `Đã phát hành tới ${data} tài khoản.` };
}

export async function expireAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Mã thông báo chung không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("expire_announcement", {
    p_announcement_id: parsed.data,
  });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateAnnouncementViews();
  return { success: "Thông báo chung đã hết hiệu lực." };
}
