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
       class_sessions (
         id, session_number, starts_at, ends_at, status, topic, lesson_log, teacher_note,
         attendance_records (id, enrollment_id, status)
       ),
       enrollments (
         id, status, enrolled_on,
         student:students (id, student_code, full_name)
       ),
       assignments (
         id, title, due_at, max_score, status, published_at,
         submissions (id, status, submitted_at, graded_at)
       ),
       assessments (
         id, title, type, assessment_date, max_score, published_at,
         assessment_results (id, published_at)
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Không tải được lớp học: ${error.message}`);
  return data;
}

/**
 * Tiến độ từng enrollment trong một lớp.
 *
 * View dùng `security_invoker`, vì vậy teacher chỉ nhận được enrollment của lớp
 * mình dạy. Filter `class_id` giúp query dùng đúng index; RLS vẫn là chốt chặn
 * nếu người dùng đổi UUID trên URL.
 */
export async function getClassProgress(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_enrollment_progress")
    .select(
      `enrollment_id, enrollment_status, student_id, attendance_rate,
       completed_lessons, total_lessons, submitted_assignments, total_assignments,
       avg_score, progress_percent, is_completion_ready`,
    )
    .eq("class_id", classId)
    .order("progress_percent", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Không tải được tiến độ lớp: ${error.message}`);
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
