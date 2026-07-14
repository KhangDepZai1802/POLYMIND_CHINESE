"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Họ tên tối thiểu 2 ký tự" })
    .max(120, { message: "Họ tên tối đa 120 ký tự" }),
  phone: z
    .string()
    .trim()
    .max(20, { message: "Số điện thoại tối đa 20 ký tự" })
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Mật khẩu tối thiểu 8 ký tự" })
      .max(72, { message: "Mật khẩu tối đa 72 ký tự" }),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirm"],
  });

/**
 * Học viên chỉ sửa được **thông tin liên hệ** của chính mình.
 *
 * `role` và `is_active` cố tình KHÔNG có trong schema này. Và đó không phải chốt
 * chặn duy nhất: trigger `app.prevent_self_privilege_escalation` ở DB từ chối mọi
 * lệnh tự đổi vai trò / tự khóa-mở tài khoản, kể cả gọi thẳng Supabase client bằng
 * JWT. Ẩn field ở form không phải là phân quyền.
 */
export async function updateMyContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("student");
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath("/student/profile");
  return { success: "Đã cập nhật thông tin liên hệ." };
}

export async function changeMyPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Không đổi được mật khẩu. Vui lòng thử lại." };
  }

  return { success: "Đã đổi mật khẩu." };
}

export async function markNotificationReadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Thiếu mã thông báo." };

  const supabase = await createClient();
  // RLS `(user_id = auth.uid())` là chốt chặn: không đánh dấu hộ thông báo của
  // người khác được, dù có đoán đúng id.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath("/student/profile");
  return { success: "Đã đánh dấu đã đọc." };
}
