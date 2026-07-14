import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Roster để chọn học viên cần đánh giá.
 *
 * Học viên đã rút/chuyển lớp không còn thuộc lớp → không nằm trong danh sách.
 * Enrollment `completed` vẫn còn: đánh giá cuối khóa thường viết sau khi học xong.
 */
export async function getEvaluationRoster(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, status,
       student:students (id, student_code, full_name),
       learning_evaluations (id, published_at),
       student_notes (id, visibility)`,
    )
    .eq("class_id", classId)
    .not("status", "in", "(withdrawn,transferred)");

  if (error)
    throw new Error(`Không tải được danh sách học viên: ${error.message}`);

  return [...data].sort((a, b) =>
    (a.student?.full_name ?? "").localeCompare(
      b.student?.full_name ?? "",
      "vi",
    ),
  );
}

/**
 * Hồ sơ đánh giá của MỘT enrollment: đánh giá + ghi chú.
 *
 * `enrollmentId` đến từ URL nên phải kiểm dạng uuid trước — chuỗi rác đi thẳng
 * xuống Postgres sẽ ném lỗi kiểu và trang trả 500 kèm stack thay vì 404.
 */
export async function getEvaluationProfile(enrollmentId: string) {
  if (!z.uuid().safeParse(enrollmentId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, status,
       student:students (id, student_code, full_name),
       class:classes (id, code, name),
       learning_evaluations (
         id, evaluation_date, period_start, period_end,
         overall_rating, listening_rating, speaking_rating, reading_rating,
         writing_rating, vocabulary_rating, grammar_rating,
         strengths, areas_for_improvement, action_plan, teacher_comment,
         visible_to_student, published_at, created_at
       ),
       student_notes (id, body, visibility, created_at)`,
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error)
    throw new Error(`Không tải được hồ sơ đánh giá: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    learning_evaluations: [...data.learning_evaluations].sort((a, b) =>
      b.evaluation_date.localeCompare(a.evaluation_date),
    ),
    student_notes: [...data.student_notes].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  };
}
