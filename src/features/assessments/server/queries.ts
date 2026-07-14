import "server-only";

import { z } from "zod";

import { getLessonOptionsForClass } from "@/features/schedules/server/queries";
import { createClient } from "@/lib/supabase/server";

/** Lớp + giáo trình để tạo bài KT. RLS quy về `class_teachers`, không lọc ở app. */
export async function getAssessmentClassContext(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status, course:courses (id, code, title)")
    .eq("id", classId)
    .maybeSingle();

  if (error)
    throw new Error(`Không tải được lớp cho bài kiểm tra: ${error.message}`);
  if (!data) return null;

  const lessons = data.course
    ? await getLessonOptionsForClass(data.course.id)
    : [];

  return { ...data, lessons };
}

/** Bài KT của một lớp + số học viên đã chấm/đã công bố. */
export async function getAssessmentsForClass(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(
      `id, class_id, lesson_id, module_id, type, title, assessment_date,
       max_score, published_at, created_at, updated_at,
       lesson:lessons (id, title),
       assessment_results (id, overall_score, published_at)`,
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Không tải được bài kiểm tra: ${error.message}`);
  return data;
}

/**
 * Bảng nhập điểm: roster của lớp + kết quả hiện có của đúng bài KT này.
 *
 * Học viên đã rút/chuyển lớp **không** nằm trong roster: chấm điểm cho họ là ghi
 * dữ liệu sai vào lịch sử (DB cũng từ chối). Ghi danh `completed` vẫn còn — bài
 * cuối kỳ thường chấm sau khi học viên đã học xong.
 */
export async function getAssessmentScoreBoard(assessmentId: string) {
  // `id` đến từ URL do người dùng gõ. Không chặn ở đây thì một chuỗi bậy bạ đi
  // thẳng xuống Postgres, ném lỗi kiểu uuid và trang trả **500 kèm stack** thay vì
  // 404 — vừa lộ thông tin, vừa sai: "không tìm thấy" mới là câu trả lời đúng.
  if (!z.uuid().safeParse(assessmentId).success) return null;

  const supabase = await createClient();
  const { data: assessment, error } = await supabase
    .from("assessments")
    .select(
      `id, class_id, lesson_id, type, title, assessment_date, max_score,
       published_at, created_at,
       class:classes (id, code, name),
       lesson:lessons (id, title)`,
    )
    .eq("id", assessmentId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được bài kiểm tra: ${error.message}`);
  if (!assessment) return null;

  const { data: roster, error: rosterError } = await supabase
    .from("enrollments")
    .select(
      `id, status,
       student:students (id, student_code, full_name),
       assessment_results (
         id, overall_score, listening_score, speaking_score, reading_score,
         writing_score, vocabulary_score, grammar_score, classification,
         feedback, graded_at, published_at
       )`,
    )
    .eq("class_id", assessment.class_id)
    .not("status", "in", "(withdrawn,transferred)")
    .eq("assessment_results.assessment_id", assessmentId);

  if (rosterError)
    throw new Error(`Không tải được danh sách học viên: ${rosterError.message}`);

  const rows = roster
    .map((enrollment) => ({
      ...enrollment,
      result: enrollment.assessment_results[0] ?? null,
    }))
    .sort((a, b) =>
      (a.student?.full_name ?? "").localeCompare(
        b.student?.full_name ?? "",
        "vi",
      ),
    );

  return { ...assessment, rows };
}
