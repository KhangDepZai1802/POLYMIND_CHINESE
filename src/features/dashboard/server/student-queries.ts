import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Dữ liệu dashboard học viên.
 *
 * **Không có một dòng `where student_id = ...` nào** trong file này — cố ý. RLS đã
 * khoanh mọi bảng về đúng học viên đang đăng nhập (`app.owns_enrollment`,
 * `app.studies_class`). Tự lọc thêm ở app là tạo nguồn sự thật thứ hai về quyền,
 * và cái ở app là cái sẽ quên cập nhật.
 *
 * Theo D-18, học viên có **tối đa một** enrollment đang mở → dashboard xoay quanh
 * đúng một lớp. Chưa được xếp lớp thì trả `enrollment = null`, không phải lỗi.
 */
export async function getStudentDashboard() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .select(
      `id, status, class:classes (id, code, name, course:courses (id, title))`,
    )
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();

  if (error) throw new Error(`Không tải được lớp của bạn: ${error.message}`);
  if (!enrollment?.class) {
    return { enrollment: null } as const;
  }

  const classId = enrollment.class.id;

  const [sessions, assignments, attendance, results, invoices] =
    await Promise.all([
      supabase
        .from("class_sessions")
        .select("id, session_number, starts_at, ends_at, topic, status")
        .eq("class_id", classId)
        .eq("status", "scheduled")
        .gte("ends_at", nowIso)
        .order("starts_at")
        .limit(5),
      // RLS: học viên chỉ thấy assignment đã publish, và chỉ thấy submission của
      // chính mình → `submissions` nhúng ở đây không lộ bài của bạn cùng lớp.
      supabase
        .from("assignments")
        .select(
          `id, title, due_at, max_score, status,
           submissions (id, status, submitted_at, score, graded_at)`,
        )
        .eq("class_id", classId)
        .eq("status", "published")
        .order("due_at", { nullsFirst: false }),
      supabase
        .from("v_student_attendance_summary")
        .select(
          "total_sessions, present_count, late_count, absent_count, excused_count, attendance_rate",
        )
        .eq("enrollment_id", enrollment.id)
        .maybeSingle(),
      supabase
        .from("assessment_results")
        .select(
          `id, overall_score, classification, published_at,
           assessment:assessments (id, title, type, max_score)`,
        )
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(5),
      supabase
        .from("v_tuition_balance")
        .select("invoice_id, invoice_code, due_date, total, balance, is_overdue")
        .gt("balance", 0)
        .order("due_date"),
    ]);

  const failed = [sessions, assignments, attendance, results, invoices].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được dashboard: ${failed.error.message}`);
  }

  // "Chưa nộp" = chưa có submission nào có `submitted_at`. Bài đã quá hạn vẫn hiện
  // ở đây: giấu đi thì học viên tưởng mình không nợ bài nào.
  const pending = (assignments.data ?? [])
    .map((assignment) => ({
      ...assignment,
      submission: assignment.submissions[0] ?? null,
    }))
    .filter((assignment) => !assignment.submission?.submitted_at);

  const graded = (assignments.data ?? [])
    .map((assignment) => ({
      ...assignment,
      submission: assignment.submissions[0] ?? null,
    }))
    .filter((assignment) => assignment.submission?.graded_at);

  return {
    enrollment,
    sessions: sessions.data ?? [],
    pendingAssignments: pending,
    gradedAssignments: graded,
    attendance: attendance.data,
    results: results.data ?? [],
    invoices: invoices.data ?? [],
  } as const;
}
