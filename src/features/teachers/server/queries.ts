import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";

export async function getTeachers(search?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("teachers")
    .select(
      `id, user_id, teacher_code, specialization, bio, employment_type, hourly_rate, is_active, created_at,
       profile:profiles!fk_teachers_profile (full_name, phone, email, username, is_active),
       class_teachers (id, class:classes (id, code, name, status))`,
    )
    .order("teacher_code");

  if (search) {
    query = query.ilike("teacher_code", `%${search}%`);
  }

  const { data, error } = await query;
  if (error)
    throw new Error(`Không tải được danh sách giáo viên: ${error.message}`);
  return data;
}

export async function getTeacherById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select(
      `*, profile:profiles!fk_teachers_profile (full_name, phone, is_active, avatar_path)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Không tải được giáo viên: ${error.message}`);
  return data;
}

/** Danh sách rút gọn để chọn khi phân công lớp. */
export async function getActiveTeacherOptions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select(
      `id, teacher_code, profile:profiles!fk_teachers_profile!inner (full_name)`,
    )
    .eq("is_active", true)
    .eq("profile.is_active", true)
    .order("teacher_code");

  if (error) throw new Error(`Không tải được giáo viên: ${error.message}`);
  return data;
}

export type TeacherAccountDirectoryRow = {
  id: string;
  user_id: string;
  teacher_code: string;
  specialization: string | null;
  is_active: boolean;
  profile: {
    full_name: string;
    username: string | null;
    phone: string | null;
    is_active: boolean;
  } | null;
};

/** Danh bạ tài khoản dành riêng cho hai giáo viên được ủy quyền. */
export async function getTeacherAccountDirectory() {
  const allowed = await permissionRpc<boolean>(
    "can_create_b2c_teacher_accounts",
  ).catch(() => false);
  if (!allowed) throw new Error("Không có quyền xem tài khoản giáo viên.");

  const { data, error } = await createAdminClient()
    .from("teachers")
    .select(
      "id,user_id,teacher_code,specialization,is_active,profile:profiles!fk_teachers_profile!inner(full_name,username,phone,is_active,role)",
    )
    .eq("profile.role", "teacher")
    .order("teacher_code");
  if (error) throw new Error("Không tải được danh sách tài khoản giáo viên.");
  return (data ?? []) as unknown as TeacherAccountDirectoryRow[];
}
