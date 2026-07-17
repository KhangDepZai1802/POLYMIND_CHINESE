import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getTeachers(search?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("teachers")
    .select(
      `id, user_id, teacher_code, specialization, bio, is_active, created_at,
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
