import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Kết quả & tiến độ của học viên.
 *
 * Ranh giới bảo mật ở đây **do RLS giữ, không phải do `where` trong file này**:
 * - `assessment_results` → chỉ row `published_at IS NOT NULL` của chính mình.
 * - `learning_evaluations` → chỉ row đã công bố **và** `visible_to_student`.
 * - `student_notes` → chỉ ghi chú `student_visible`; ghi chú `staff_only` của giáo
 *   viên **không bao giờ** đi qua đây, kể cả khi ai đó lỡ bỏ điều kiện lọc ở app.
 */
export async function getMyResults(enrollmentId: string) {
  const supabase = await createClient();

  const [results, evaluations, notes, progress] = await Promise.all([
    supabase
      .from("assessment_results")
      .select(
        `id, overall_score, listening_score, speaking_score, reading_score,
         writing_score, vocabulary_score, grammar_score, classification,
         feedback, published_at,
         assessment:assessments (id, title, type, assessment_date, max_score)`,
      )
      .order("published_at", { ascending: false }),
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
      .from("v_enrollment_progress")
      .select(
        `total_lessons, completed_lessons, total_assignments,
         submitted_assignments, avg_score, attendance_rate, progress_percent,
         is_completion_ready`,
      )
      .eq("enrollment_id", enrollmentId)
      .maybeSingle(),
  ]);

  const failed = [results, evaluations, notes, progress].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được kết quả: ${failed.error.message}`);
  }

  return {
    results: results.data ?? [],
    evaluations: evaluations.data ?? [],
    notes: notes.data ?? [],
    progress: progress.data,
  };
}
