import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentAssessmentOverview } from "@/features/assessment-results/server/overview";

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

  const [sessions, overview, attendance, invoices] =
    await Promise.all([
      supabase
        .from("class_sessions")
        .select("id, session_number, starts_at, ends_at, topic, status")
        .eq("class_id", classId)
        .eq("status", "scheduled")
        .gte("ends_at", nowIso)
        .order("starts_at")
        .limit(5),
      getStudentAssessmentOverview(),
      supabase
        .from("v_student_attendance_summary")
        .select(
          "total_sessions, present_count, late_count, absent_count, excused_count, attendance_rate",
        )
        .eq("enrollment_id", enrollment.id)
        .maybeSingle(),
      supabase
        .from("v_tuition_balance")
        .select("invoice_id, invoice_code, due_date, total, balance, is_overdue")
        .gt("balance", 0)
        .order("due_date"),
    ]);

  const failed = [sessions, attendance, invoices].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được dashboard: ${failed.error.message}`);
  }

  const pending = overview.exercises.filter(
    (exercise) => !exercise.attempts.some((attempt) => attempt.submitted_at),
  );
  const publishedExerciseResults = overview.exercises.flatMap((exercise) =>
    exercise.attempts
      .filter((attempt) => attempt.results_published_at)
      .map((attempt) => ({
        id: attempt.id,
        title: exercise.title,
        kind: "Bài tập",
        score: attempt.final_score,
        maxScore: exercise.max_score,
        publishedAt: attempt.results_published_at!,
        href: `/student/exercises/results/${attempt.id}`,
      })),
  );
  const publishedExamResults = overview.exams.flatMap((exam) =>
    exam.results_published_at
      ? exam.attempts.map((attempt) => ({
          id: attempt.id,
          title: exam.title,
          kind: "Kỳ thi",
          score: attempt.final_score_100,
          maxScore: 100,
          publishedAt: exam.results_published_at!,
          href: `/student/exams/results/${attempt.id}`,
        }))
      : [],
  );

  return {
    enrollment,
    sessions: sessions.data ?? [],
    pendingExercises: pending,
    attendance: attendance.data,
    results: [...publishedExerciseResults, ...publishedExamResults]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 5),
    invoices: invoices.data ?? [],
  } as const;
}
