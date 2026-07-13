import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getStudents(params?: {
  search?: string;
  status?: string;
}) {
  const supabase = await createClient();

  // Lấy đủ cột: form "Sửa hồ sơ" mở ngay từ danh sách nên cần toàn bộ trường,
  // không phải fetch lại lần hai.
  let query = supabase
    .from("students")
    .select(
      `*,
       current_level:levels!students_current_level_id_fkey (id, code, name),
       enrollments (id, status, class:classes (id, code, name))`,
    )
    .order("student_code");

  if (params?.search) {
    query = query.or(
      `student_code.ilike.%${params.search}%,full_name.ilike.%${params.search}%,phone.ilike.%${params.search}%`,
    );
  }
  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Không tải được danh sách học viên: ${error.message}`);
  return data;
}

export async function getStudentById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(
      `*,
       current_level:levels!students_current_level_id_fkey (id, code, name),
       target_level:levels!students_target_level_id_fkey (id, code, name),
       profile:profiles!fk_students_profile (full_name, email, is_active)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Không tải được học viên: ${error.message}`);
  return data;
}

/** Các lớp học viên này đang/đã học, kèm tiến độ tính từ view. */
export async function getStudentEnrollments(studentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, status, enrolled_on, started_on, ended_on, reason,
       class:classes (id, code, name, status, start_date, delivery_mode,
                      course:courses (id, code, title))`,
    )
    .eq("student_id", studentId)
    .order("enrolled_on", { ascending: false });

  if (error) throw new Error(`Không tải được lớp của học viên: ${error.message}`);
  return data;
}

export async function getStudentProgress(studentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_enrollment_progress")
    .select("*")
    .eq("student_id", studentId);

  if (error) throw new Error(`Không tải được tiến độ: ${error.message}`);
  return data;
}

/** Danh sách rút gọn để chọn khi ghi danh. */
export async function getStudentOptions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("id, student_code, full_name")
    .eq("status", "active")
    .order("student_code");

  if (error) throw new Error(`Không tải được học viên: ${error.message}`);
  return data;
}
