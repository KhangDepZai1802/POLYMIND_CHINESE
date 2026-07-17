"use server";

import { revalidatePath } from "next/cache";

import {
  accountCredentialsUpdateSchema,
  accountToggleSchema,
} from "@/features/accounts/schema";
import { provisionPasswordAccount } from "@/features/users/server/account";
import { setUserActive } from "@/features/users/server/invite";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUserRole } from "@/types/roles";

/**
 * Đổi tên đăng nhập + đặt lại mật khẩu cho MỘT tài khoản bất kỳ.
 *
 * Dùng lại `provisionPasswordAccount` — cùng một đường ghi với luồng tạo giáo
 * viên/học viên, nên không có ba cách set mật khẩu khác nhau. Mật khẩu cũ KHÔNG
 * bao giờ đọc lại được (Supabase hash một chiều); chỉ đặt được cái mới.
 */
export async function updateAccountCredentialsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = accountCredentialsUpdateSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const { user_id, username, password } = parsed.data;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, role")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile || !isUserRole(profile.role))
    return { error: "Không tìm thấy tài khoản." };

  const result = await provisionPasswordAccount({
    userId: profile.id,
    username,
    password,
    fullName: profile.full_name,
    phone: profile.phone,
    contactEmail: profile.email,
    role: profile.role,
  });
  if (!result.ok) return { error: result.error };

  await logAudit(supabase, {
    action: "account.credentials_update",
    resourceType: "account",
    resourceId: profile.id,
    after: { username, role: profile.role },
  });

  revalidatePath("/admin/system");
  return { success: `Đã cập nhật tài khoản ${username}.` };
}

/**
 * Khóa / mở một tài khoản bất kỳ.
 *
 * Chặn tự khóa chính mình — nếu không, admin cuối cùng có thể tự đá mình ra
 * ngoài và không ai vào lại được. Với giáo viên, đồng bộ luôn `teachers.is_active`
 * để danh sách phân công không lệch với trạng thái đăng nhập.
 */
export async function toggleAccountActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole("super_admin");

  const parsed = accountToggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { user_id, activate } = parsed.data;

  if (user_id === me.id && !activate)
    return { error: "Không thể tự khóa tài khoản của chính bạn." };

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile) return { error: "Không tìm thấy tài khoản." };

  const result = await setUserActive(profile.id, activate);
  if (!result.ok) return { error: result.error ?? "Không đổi được trạng thái." };

  if (profile.role === "teacher") {
    const { error } = await supabase
      .from("teachers")
      .update({ is_active: activate })
      .eq("user_id", profile.id);
    if (error) return { error: dbErrorToMessage(error) };
  }

  await logAudit(supabase, {
    action: activate ? "account.activate" : "account.deactivate",
    resourceType: "account",
    resourceId: profile.id,
    after: { username: profile.username, is_active: activate },
  });

  revalidatePath("/admin/system");
  return {
    success: activate ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.",
  };
}
