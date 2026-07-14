import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** Các lớp RLS cho phép giáo viên hiện tại quản lý bài tập. */
export async function getAssignmentClassOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status, course:courses (id, code, title)")
    .neq("status", "cancelled")
    .order("code");

  if (error) throw new Error(`Không tải được danh sách lớp: ${error.message}`);
  return data;
}

/** Ngữ cảnh tạo assignment: bài học và buổi học đều phải thuộc đúng lớp. */
export async function getAssignmentClassContext(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, code, name, status,
       course:courses (id, code, title),
       class_sessions (id, session_number, starts_at, status, topic, lesson_id)`,
    )
    .eq("id", classId)
    .maybeSingle();

  if (error)
    throw new Error(`Không tải được lớp cho bài tập: ${error.message}`);
  if (!data?.course) return data ? { ...data, lessons: [] } : null;

  const { data: modules, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, title, order_index, lessons (id, title, order_index)")
    .eq("course_id", data.course.id)
    .order("order_index");

  if (moduleError) {
    throw new Error(
      `Không tải được giáo trình cho bài tập: ${moduleError.message}`,
    );
  }

  const lessons = modules.flatMap((module) =>
    [...module.lessons]
      .sort((a, b) => a.order_index - b.order_index)
      .map((lesson) => ({
        id: lesson.id,
        label: `Chương ${module.order_index} · Bài ${lesson.order_index}: ${lesson.title}`,
      })),
  );

  return {
    ...data,
    lessons,
    class_sessions: [...data.class_sessions].sort(
      (a, b) => a.session_number - b.session_number,
    ),
  };
}

/** Danh sách bài tập của một lớp; RLS là chốt scope cuối cùng. */
export async function getAssignmentsForClass(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, class_id, lesson_id, session_id, title, instructions, due_at,
       max_score, allow_late_submission, max_attempts, status, published_at,
       created_at, updated_at,
       lesson:lessons (id, title),
       session:class_sessions (id, session_number, starts_at, topic),
       assignment_attachments (
         id, object_path, file_name, mime_type, size_bytes, created_at
       ),
       submissions (id, status, submitted_at, graded_at)`,
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Không tải được bài tập: ${error.message}`);
  return data;
}

/**
 * Một assignment cùng toàn bộ bài nộp mà RLS cho teacher hiện tại đọc được.
 *
 * `assignmentId` đến từ URL nên phải kiểm dạng UUID trước. Nếu đưa chuỗi rác
 * xuống Postgres, phép so sánh với cột UUID sẽ lỗi và biến một URL không tồn tại
 * thành phản hồi 500 thay vì 404.
 */
export async function getSubmissionGradingBoard(assignmentId: string) {
  if (!z.uuid().safeParse(assignmentId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, class_id, title, instructions, due_at, max_score, status, published_at,
       class:classes (id, code, name),
       submissions (
         id, attempt_no, text_answer, submitted_at, is_late, status,
         score, feedback, graded_by, graded_at, created_at, updated_at,
         enrollment:enrollments (
           id, status,
           student:students (id, student_code, full_name)
         ),
         submission_files (
           id, object_path, file_name, mime_type, size_bytes, created_at
         )
       )`,
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được bài nộp: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    submissions: [...data.submissions]
      .filter((submission) => submission.submitted_at !== null)
      .sort((a, b) =>
        (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""),
      ),
  };
}
