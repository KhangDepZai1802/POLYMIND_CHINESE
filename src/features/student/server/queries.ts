import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Toàn bộ query của cổng học viên.
 *
 * **Không có `where student_id = ...` ở bất kỳ đâu trong file này** — RLS đã khoanh
 * mọi bảng về đúng học viên đang đăng nhập. Nếu lọc thêm ở app thì có hai nguồn sự
 * thật về quyền, và cái ở app là cái sẽ quên cập nhật.
 *
 * Theo D-18, học viên có tối đa **một** enrollment đang mở.
 */
export async function getMyEnrollment() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, status,
       class:classes (id, code, name, course:courses (id, code, title))`,
    )
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();

  if (error) throw new Error(`Không tải được lớp của bạn: ${error.message}`);
  return data?.class ? data : null;
}

/**
 * Thông tin lớp cho trang "Lớp của tôi" — bản CHỈ ĐỌC của học viên.
 *
 * RLS cho học viên đọc: `classes` (studies_class), `class_teachers`,
 * `class_schedules`, `teachers`/`profiles` của giáo viên dạy lớp mình. **Không**
 * đọc được `students`/`enrollments` của bạn cùng lớp — nên ở đây không có roster.
 */
export async function getMyClassOverview(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, code, name, capacity, status, start_date, expected_end_date,
       planned_session_count, session_duration_minutes, target_audience,
       delivery_mode, location_name, address, location_note, meeting_url,
       course:courses (id, code, title),
       class_teachers (
         id,
         teacher:teachers (
           id, teacher_code, specialization,
           profile:profiles!fk_teachers_profile (full_name)
         )
       ),
       class_schedules (id, weekday, start_time, end_time, effective_from, effective_to)`,
    )
    .eq("id", classId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được thông tin lớp: ${error.message}`);
  return data;
}

/** Lịch học của lớp + điểm danh CỦA MÌNH ở từng buổi (RLS lọc, không lọc ở app). */
export async function getMySchedule(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, topic, status,
       lesson:lessons (id, title),
       attendance_records (id, status, note)`,
    )
    .eq("class_id", classId)
    .order("session_number");

  if (error) throw new Error(`Không tải được lịch học: ${error.message}`);

  return data.map((session) => ({
    ...session,
    myAttendance: session.attendance_records[0] ?? null,
  }));
}

/** Tài liệu khóa học. RLS chỉ trả tài liệu `enrolled_students` của khóa mình học. */
export async function getMyMaterials(courseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_materials")
    .select(
      `id, title, object_path, mime_type, size_bytes, created_at,
       module:course_modules (id, title, order_index),
       lesson:lessons (id, title, order_index)`,
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Không tải được tài liệu: ${error.message}`);
  return data;
}

/** Tiến độ tổng hợp của chính mình trong lớp (RLS: view security_invoker). */
export async function getMyProgress(enrollmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_enrollment_assessment_progress")
    .select(
      `total_lessons, completed_lessons, total_exercises, submitted_exercises,
       avg_score, attendance_rate, progress_percent, is_completion_ready`,
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được tiến độ: ${error.message}`);
  return data;
}

/** Tổng hợp chuyên cần của chính mình. */
export async function getMyAttendanceSummary(enrollmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_student_attendance_summary")
    .select(
      "total_sessions, present_count, late_count, absent_count, excused_count, attendance_rate",
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được chuyên cần: ${error.message}`);
  return data;
}
