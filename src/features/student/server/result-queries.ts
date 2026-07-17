import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Kết quả & tiến độ của học viên.
 *
 * Ranh giới bảo mật ở đây **do RLS giữ, không phải do `where` trong file này**:
 * - attempt bài tập/kỳ thi → chỉ trả điểm sau công bố.
 * - `learning_evaluations` → chỉ row đã công bố **và** `visible_to_student`.
 * - `student_notes` → chỉ ghi chú `student_visible`; ghi chú `staff_only` của giáo
 *   viên **không bao giờ** đi qua đây, kể cả khi ai đó lỡ bỏ điều kiện lọc ở app.
 */
export async function getMyResults(enrollmentId: string) {
  const supabase = await createClient();

  const [exerciseResults, examResults, evaluations, notes, progress] = await Promise.all([
    supabase
      .from("exercise_attempts")
      .select("id,final_score,results_published_at,delivery:exercise_deliveries(title,max_score)")
      .not("results_published_at", "is", null)
      .order("results_published_at", { ascending: false }),
    supabase
      .from("exam_attempts")
      .select("id,final_score_100,delivery:exam_deliveries(title,results_published_at)")
      .not("delivery.results_published_at", "is", null),
    supabase
      .from("learning_evaluations")
      .select(
        `id, evaluation_date, period_start, period_end,
         overall_rating, listening_rating, speaking_rating, reading_rating,
         writing_rating, vocabulary_rating, grammar_rating,
         strengths, areas_for_improvement, action_plan, teacher_comment,
         published_at`,
      )
      .order("evaluation_date", { ascending: false }),
    supabase
      .from("student_notes")
      .select("id, body, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("v_enrollment_assessment_progress")
      .select(
        `total_lessons, completed_lessons, total_exercises,
         submitted_exercises, avg_score, attendance_rate, progress_percent,
         is_completion_ready`,
      )
      .eq("enrollment_id", enrollmentId)
      .maybeSingle(),
  ]);

  const failed = [exerciseResults, examResults, evaluations, notes, progress].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được kết quả: ${failed.error.message}`);
  }

  return {
    results: [
      ...(exerciseResults.data ?? []).map((row) => ({
        id: row.id,
        title: row.delivery?.title ?? "Bài tập",
        kind: "Bài tập",
        score: row.final_score,
        maxScore: row.delivery?.max_score ?? 0,
        publishedAt: row.results_published_at!,
        href: `/student/exercises/results/${row.id}`,
      })),
      ...(examResults.data ?? []).map((row) => ({
        id: row.id,
        title: row.delivery?.title ?? "Kỳ thi",
        kind: "Kỳ thi",
        score: row.final_score_100,
        maxScore: 100,
        publishedAt: row.delivery?.results_published_at ?? "",
        href: `/student/exams/results/${row.id}`,
      })),
    ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    evaluations: evaluations.data ?? [],
    notes: notes.data ?? [],
    progress: progress.data,
  };
}
