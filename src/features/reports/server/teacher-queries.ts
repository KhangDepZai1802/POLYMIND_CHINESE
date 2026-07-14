import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Báo cáo lớp cho giáo viên.
 *
 * 5 view báo cáo đều là `security_invoker` → RLS chạy dưới danh nghĩa người gọi và
 * tự khoanh về `class_teachers`. Vì vậy ở đây **không có một dòng `where teacher_id`
 * nào**: cùng câu query này, admin thấy mọi lớp, giáo viên chỉ thấy lớp mình dạy.
 * Tự lọc thêm ở app là tạo nguồn sự thật thứ hai về quyền — và cái ở app là cái sẽ
 * quên cập nhật.
 *
 * View không có FK nên PostgREST không embed được tên học viên; ghép theo
 * `enrollment_id` ở đây thay vì viết SQL join mới.
 */
export async function getTeacherClassReport(classId: string) {
  const supabase = await createClient();

  const [classProgress, enrollments, progress, attendance, atRisk] =
    await Promise.all([
      supabase
        .from("v_class_progress")
        .select(
          `class_id, class_code, class_name, status, capacity, active_students,
           completed_students, avg_attendance_rate, avg_score, avg_progress_percent`,
        )
        .eq("class_id", classId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, status, student:students (id, student_code, full_name)")
        .eq("class_id", classId)
        .not("status", "in", "(withdrawn,transferred)"),
      supabase
        .from("v_enrollment_progress")
        .select(
          `enrollment_id, total_lessons, completed_lessons, total_assignments,
           submitted_assignments, avg_score, attendance_rate, progress_percent,
           is_completion_ready`,
        )
        .eq("class_id", classId),
      supabase
        .from("v_student_attendance_summary")
        .select(
          `enrollment_id, total_sessions, present_count, late_count,
           absent_count, excused_count, attendance_rate`,
        )
        .eq("class_id", classId),
      supabase
        .from("v_at_risk_students")
        .select(
          `enrollment_id, full_name, student_code, attendance_rate, avg_score,
           progress_percent, missing_assignments, risk_reasons`,
        )
        .eq("class_id", classId),
    ]);

  const failed = [classProgress, enrollments, progress, attendance, atRisk].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được báo cáo lớp: ${failed.error.message}`);
  }

  const progressByEnrollment = new Map(
    (progress.data ?? []).map((row) => [row.enrollment_id, row]),
  );
  const attendanceByEnrollment = new Map(
    (attendance.data ?? []).map((row) => [row.enrollment_id, row]),
  );

  const rows = (enrollments.data ?? [])
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      status: enrollment.status,
      student: enrollment.student,
      progress: progressByEnrollment.get(enrollment.id) ?? null,
      attendance: attendanceByEnrollment.get(enrollment.id) ?? null,
    }))
    .sort((a, b) =>
      (a.student?.full_name ?? "").localeCompare(
        b.student?.full_name ?? "",
        "vi",
      ),
    );

  return {
    summary: classProgress.data,
    rows,
    atRisk: atRisk.data ?? [],
  };
}
