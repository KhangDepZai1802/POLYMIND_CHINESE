"use server";

import { revalidatePath } from "next/cache";
import {
  teacherAccountTargetSchema,
  teacherPasswordChangeSchema,
  type TeacherAccountTarget,
  type TeacherAccountDetails,
} from "../account-schema";
import { requireUser } from "@/lib/auth/session";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Resolve the shared teacher/account by persisted IDs. Never match by name/email.
async function resolveTeacher(target: TeacherAccountTarget) {
  const admin = createAdminClient();
  let teacherId = target.id;
  if (target.kind === "b2c") {
    const { data, error } = await admin
      .from("b2c_teachers")
      .select("source_teacher_id")
      .eq("id", target.id)
      .maybeSingle();
    if (error) throw new Error("Không tải được liên kết tài khoản giáo viên.");
    if (!data) throw new Error("Không tìm thấy giáo viên.");
    if (!data.source_teacher_id) return null;
    teacherId = data.source_teacher_id;
  }
  const { data: teacher, error } = await admin
    .from("teachers")
    .select(
      "id,user_id,is_active,profile:profiles!fk_teachers_profile(full_name,username,role,is_active)",
    )
    .eq("id", teacherId)
    .maybeSingle();
  if (error) throw new Error("Không tải được tài khoản giáo viên.");
  if (
    !teacher?.profile ||
    !["teacher", "academic_manager"].includes(teacher.profile.role)
  )
    throw new Error("Không tìm thấy tài khoản giáo viên hợp lệ.");
  return teacher;
}

async function requireTeacherAccountManager() {
  const actor = await requireUser();
  if (actor.role === "super_admin") return { delegated: false };
  const delegated = await permissionRpc<boolean>(
    "can_create_b2c_teacher_accounts",
  ).catch(() => false);
  if (!delegated) throw new Error("Không có quyền quản lý tài khoản giáo viên.");
  return { delegated: true };
}

export async function readTeacherAccountAction(
  input: unknown,
): Promise<{ account: TeacherAccountDetails | null; error?: string }> {
  const access = await requireTeacherAccountManager();
  const parsed = teacherAccountTargetSchema.safeParse(input);
  if (!parsed.success)
    return { account: null, error: "Mã giáo viên không hợp lệ." };
  try {
    const teacher = await resolveTeacher(parsed.data);
    if (!teacher) return { account: null };
    if (access.delegated && teacher.profile!.role !== "teacher")
      return { account: null, error: "Bạn chỉ được quản lý tài khoản Giáo viên." };
    const { data, error } = await createAdminClient().auth.admin.getUserById(
      teacher.user_id,
    );
    if (error || !data.user)
      return {
        account: null,
        error: "Không tải được tài khoản đăng nhập. Vui lòng thử lại.",
      };
    const profile = teacher.profile!;
    return {
      account: {
        teacher_id: teacher.id,
        user_id: teacher.user_id,
        full_name: profile.full_name,
        username: profile.username,
        login: profile.username || data.user.email || "Chưa có tên đăng nhập",
        role: profile.role as TeacherAccountDetails["role"],
        account_active: profile.is_active,
        teacher_active: teacher.is_active,
      },
    };
  } catch (e) {
    return {
      account: null,
      error: e instanceof Error ? e.message : "Không tải được tài khoản.",
    };
  }
}

export async function changeTeacherPasswordAction(
  input: FormData,
): Promise<{ success?: string; error?: string }> {
  const access = await requireTeacherAccountManager();
  const parsed = teacherPasswordChangeSchema.safeParse(
    input instanceof FormData ? Object.fromEntries(input) : null,
  );
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  try {
    const teacher = await resolveTeacher(parsed.data);
    if (!teacher) return { error: "Giáo viên chưa liên kết tài khoản." };
    if (access.delegated && teacher.profile!.role !== "teacher")
      return { error: "Bạn chỉ được đặt lại mật khẩu cho tài khoản Giáo viên." };
    if (teacher.user_id !== parsed.data.expected_user_id)
      return {
        error: "Liên kết tài khoản đã thay đổi. Vui lòng đóng và mở lại.",
      };
    const { error } = await createAdminClient().auth.admin.updateUserById(
      teacher.user_id,
      { password: parsed.data.password },
    );
    if (error)
      return {
        error:
          "Không đổi được mật khẩu. Mật khẩu mới cần khác mật khẩu hiện tại và đáp ứng chính sách bảo mật.",
      };
    const client = await createClient();
    await logAudit(client, {
      action: "teacher.password_reset",
      resourceType: "teacher",
      resourceId: teacher.id,
      after: {
        user_id: teacher.user_id,
        username: teacher.profile!.username,
        source: parsed.data.kind,
      },
    });
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/b2c/teachers");
    revalidatePath("/teacher/teachers");
    return { success: "Đã đổi mật khẩu giáo viên." };
  } catch {
    return {
      error: "Không xử lý được yêu cầu. Vui lòng tải lại tài khoản và thử lại.",
    };
  }
}
