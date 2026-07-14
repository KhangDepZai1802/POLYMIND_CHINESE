import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getClasses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, code, name, capacity, status, start_date, expected_end_date,
       planned_session_count, session_duration_minutes, delivery_mode, location_name,
       course:courses (id, code, title),
       class_teachers (
         id, teacher_id, assignment_role,
         teacher:teachers (id, teacher_code, profile:profiles!fk_teachers_profile (full_name))
       ),
       enrollments (id, status)`,
    )
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("code");

  if (error) throw new Error(`Không tải được danh sách lớp: ${error.message}`);
  return data;
}

export async function getClassById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `*,
       course:courses (id, code, title, course_type, status),
       class_teachers (
         id, teacher_id, assignment_role, created_at,
         teacher:teachers (
           id, teacher_code, specialization,
           profile:profiles!fk_teachers_profile (full_name, phone, email)
         )
       ),
       class_schedules (id, weekday, start_time, end_time, effective_from, effective_to),
       class_sessions (id, session_number, starts_at, ends_at, status),
       enrollments (
         id, status, enrolled_on,
         student:students (id, student_code, full_name)
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Không tải được lớp học: ${error.message}`);
  return data;
}

export async function getClassOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status, capacity")
    .neq("status", "cancelled")
    .order("code");

  if (error) throw new Error(`Không tải được danh sách lớp: ${error.message}`);
  return data;
}

export async function getCourseOptionsForClasses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, code, title, status, default_session_count, default_session_duration_minutes",
    )
    .neq("status", "archived")
    .order("code");

  if (error)
    throw new Error(`Không tải được khóa học để mở lớp: ${error.message}`);
  return data;
}
