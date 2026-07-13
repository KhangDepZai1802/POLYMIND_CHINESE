"use server";

import { revalidatePath } from "next/cache";

import {
  teacherSchema,
  teacherUpdateSchema,
} from "@/features/teachers/schema";
import { inviteUser, resendInvite, setUserActive } from "@/features/users/server/invite";
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

  const invited = await inviteUser({
    email: input.email,
    fullName: input.full_name,
    role: "teacher",
    phone: input.phone,
  });

  if (!invited.ok) return { error: invited.error };

  // Dùng admin client: `teachers` chưa có dòng nào cho user này nên RLS của
  // super_admin vẫn insert được, nhưng nếu email đã tồn tại và profile vừa được
  // upsert bằng admin client thì dùng cùng client cho nhất quán transaction-ish.
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teachers")
    .insert({
      user_id: invited.userId,
      teacher_code: input.teacher_code,
      specialization: input.specialization,
      bio: input.bio,
    })
    .select("id, teacher_code")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Mã giáo viên đã tồn tại, hoặc người này đã là giáo viên."
          : dbErrorToMessage(error),
    };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "teacher.create",
    resourceType: "teacher",
    resourceId: data.id,
    after: { teacher_code: data.teacher_code, email: input.email },
  });

  revalidatePath("/admin/teachers");
  return {
    success: invited.alreadyExisted
      ? `Đã liên kết giáo viên với tài khoản ${input.email} (tài khoản đã tồn tại).`
      : `Đã tạo giáo viên và gửi lời mời tới ${input.email}.`,
  };
}

export async function updateTeacherAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = teacherUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { id, full_name, phone, teacher_code, specialization, bio } = parsed.data;

  const supabase = await createClient();

  const { data: teacher, error: fetchError } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !teacher) return { error: "Không tìm thấy giáo viên." };

  const { error } = await supabase
    .from("teachers")
    .update({ teacher_code, specialization, bio })
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
    after: { teacher_code, full_name },
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
  if (!result.ok) return { error: result.error ?? "Không đổi được trạng thái." };

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

export async function resendTeacherInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const email = formData.get("email");
  if (typeof email !== "string" || !email) return { error: "Thiếu email." };

  const result = await resendInvite(email);
  if (!result.ok) return { error: `Không gửi lại được lời mời: ${result.error}` };

  return { success: `Đã gửi lại lời mời tới ${email}.` };
}
