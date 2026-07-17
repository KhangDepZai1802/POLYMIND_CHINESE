"use server";

import { revalidatePath } from "next/cache";

import {
  teacherCredentialsSchema,
  teacherSchema,
  teacherUpdateSchema,
} from "@/features/teachers/schema";
import { provisionPasswordAccount } from "@/features/users/server/account";
import { setUserActive } from "@/features/users/server/invite";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Tạo giáo viên = mời tài khoản + tạo hồ sơ.
 *
 * Giáo viên BẮT BUỘC có tài khoản (`teachers.user_id` NOT NULL) — họ phải đăng
 * nhập để điểm danh và chấm bài. Khác với học viên: hồ sơ học viên tạo được
 * trước, mời sau (trung tâm nhập danh sách lớp trước khi có email).
 */
export async function createTeacherAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = teacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const input = parsed.data;

  const account = await provisionPasswordAccount({
    username: input.username,
    password: input.password,
    fullName: input.full_name,
    role: "teacher",
    phone: input.phone,
    contactEmail: input.email,
  });

  if (!account.ok) return { error: account.error };

  // Dùng admin client: `teachers` chưa có dòng nào cho user này nên RLS của
  // super_admin vẫn insert được, nhưng nếu email đã tồn tại và profile vừa được
  // upsert bằng admin client thì dùng cùng client cho nhất quán transaction-ish.
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teachers")
    .insert({
      user_id: account.userId,
      specialization: input.specialization,
      bio: input.bio,
    })
    .select("id, teacher_code")
    .single();

  if (error) {
    if (account.created) {
      await admin.auth.admin.deleteUser(account.userId);
    }
    return {
      error:
        error.code === "23505"
          ? "Người này đã có hồ sơ giáo viên."
          : dbErrorToMessage(error),
    };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "teacher.create",
    resourceType: "teacher",
    resourceId: data.id,
    after: { teacher_code: data.teacher_code, username: input.username },
  });

  revalidatePath("/admin/teachers");
  return { success: `Đã tạo giáo viên và cấp tài khoản ${input.username}.` };
}

export async function updateTeacherAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = teacherUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { id, full_name, phone, specialization, bio } = parsed.data;

  const supabase = await createClient();

  const { data: teacher, error: fetchError } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !teacher) return { error: "Không tìm thấy giáo viên." };

  const { error } = await supabase
    .from("teachers")
    .update({ specialization, bio })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  // Tên và SĐT nằm ở `profiles`. Super admin có policy ALL trên profiles nên
  // KHÔNG cần admin client ở đây — RLS cho phép.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, phone })
    .eq("id", teacher.user_id);

  if (profileError) return { error: dbErrorToMessage(profileError) };

  await logAudit(supabase, {
    action: "teacher.update",
    resourceType: "teacher",
    resourceId: id,
    after: { full_name },
  });

  revalidatePath("/admin/teachers");
  return { success: "Đã lưu thay đổi." };
}

/**
 * Khóa / mở tài khoản giáo viên.
 *
 * Khóa `profiles.is_active` (chặn đăng nhập) VÀ `teachers.is_active` (ẩn khỏi
 * danh sách phân công). Hai cờ khác nhau: một người có thể nghỉ dạy nhưng vẫn
 * cần đăng nhập xem lại lớp cũ.
 */
export async function toggleTeacherActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const activate = formData.get("activate") === "true";
  if (typeof id !== "string") return { error: "Thiếu mã giáo viên." };

  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("user_id, teacher_code")
    .eq("id", id)
    .maybeSingle();

  if (!teacher) return { error: "Không tìm thấy giáo viên." };

  const { error } = await supabase
    .from("teachers")
    .update({ is_active: activate })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  const result = await setUserActive(teacher.user_id, activate);
  if (!result.ok)
    return { error: result.error ?? "Không đổi được trạng thái." };

  await logAudit(supabase, {
    action: activate ? "teacher.activate" : "teacher.deactivate",
    resourceType: "teacher",
    resourceId: id,
    after: { is_active: activate, teacher_code: teacher.teacher_code },
  });

  revalidatePath("/admin/teachers");
  return {
    success: activate
      ? "Đã mở khóa tài khoản giáo viên."
      : "Đã khóa tài khoản giáo viên. Họ không đăng nhập được nữa.",
  };
}

export async function resetTeacherPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = teacherCredentialsSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select(
      "id, user_id, profile:profiles!fk_teachers_profile(full_name, phone, email)",
    )
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!teacher?.profile) return { error: "Không tìm thấy giáo viên." };

  const result = await provisionPasswordAccount({
    userId: teacher.user_id,
    username: parsed.data.username,
    password: parsed.data.password,
    fullName: teacher.profile.full_name,
    phone: teacher.profile.phone,
    contactEmail: teacher.profile.email,
    role: "teacher",
  });
  if (!result.ok) return { error: result.error };

  await logAudit(supabase, {
    action: "teacher.password_reset",
    resourceType: "teacher",
    resourceId: teacher.id,
    after: { username: parsed.data.username },
  });

  revalidatePath("/admin/teachers");
  return { success: "Đã cập nhật tên đăng nhập và mật khẩu." };
}
