"use server";

import { revalidatePath } from "next/cache";

import {
  studentAccountSchema,
  studentSchema,
  studentUpdateSchema,
} from "@/features/students/schema";
import { provisionPasswordAccount } from "@/features/users/server/account";
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
 * Tạo hồ sơ học viên — CHƯA cần tài khoản.
 *
 * `students.user_id` nullable là quyết định nghiệp vụ, không phải thiếu sót:
 * trung tâm nhận danh sách lớp từ đối tác (VCB) và nhập trước, có email hay
 * không tính sau. Ép phải có email ngay thì không nhập nổi danh sách.
 */
export async function createStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .insert(parsed.data)
    .select("id, student_code, full_name")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "student.create",
    resourceType: "student",
    resourceId: data.id,
    after: { student_code: data.student_code, full_name: data.full_name },
  });

  revalidatePath("/admin/students");
  return { success: `Đã tạo hồ sơ học viên "${data.full_name}".` };
}

export async function updateStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = studentUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { id, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("students")
    .select("student_code, full_name, status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("students").update(fields).eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "student.update",
    resourceType: "student",
    resourceId: id,
    before,
    after: { full_name: fields.full_name },
  });

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return { success: "Đã lưu thay đổi." };
}

/**
 * Mời học viên tạo tài khoản (sau khi hồ sơ đã tồn tại).
 *
 * Link `students.user_id` với `auth.users.id`. Từ lúc này học viên đăng nhập
 * được và RLS `app.my_student_id()` bắt đầu nhận ra họ.
 */
export async function provisionStudentAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = studentAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { id, email, username, password } = parsed.data;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, phone, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!student) return { error: "Không tìm thấy học viên." };

  const account = await provisionPasswordAccount({
    userId: student.user_id,
    username,
    password,
    fullName: student.full_name,
    role: "student",
    phone: student.phone,
    contactEmail: email,
  });

  if (!account.ok) return { error: account.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("students")
    .update({ user_id: account.userId, email })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Tài khoản này đã được liên kết với một học viên khác."
          : dbErrorToMessage(error),
    };
  }

  await logAudit(supabase, {
    action: student.user_id
      ? "student.password_reset"
      : "student.account_create",
    resourceType: "student",
    resourceId: id,
    after: { username, email },
  });

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return {
    success: student.user_id
      ? "Đã cập nhật tên đăng nhập và mật khẩu."
      : `Đã cấp tài khoản ${username} cho học viên.`,
  };
}

/**
 * Lưu trữ học viên.
 *
 * KHÔNG hard delete: xóa học viên là xóa luôn lịch sử điểm danh, bài nộp, điểm
 * số và hóa đơn của họ. FK `ON DELETE RESTRICT` sẽ chặn, nhưng đúng hơn là
 * đừng bao giờ thử.
 */
export async function archiveStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Thiếu mã học viên." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "student.archive",
    resourceType: "student",
    resourceId: id,
    after: { status: "archived" },
  });

  revalidatePath("/admin/students");
  return { success: "Đã lưu trữ hồ sơ học viên." };
}
