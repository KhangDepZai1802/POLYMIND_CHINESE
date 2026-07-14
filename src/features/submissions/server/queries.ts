import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Bài tập của lớp mình + bài nộp CỦA MÌNH.
 *
 * RLS chỉ trả assignment đã `published` và submission thuộc enrollment của mình →
 * `submissions` nhúng ở đây **không** lộ bài của bạn cùng lớp.
 */
export async function getMyAssignments(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, title, instructions, due_at, max_score, allow_late_submission,
       status, published_at,
       submissions (id, status, submitted_at, is_late, score, graded_at)`,
    )
    .eq("class_id", classId)
    .eq("status", "published")
    .order("due_at", { nullsFirst: false });

  if (error) throw new Error(`Không tải được bài tập: ${error.message}`);

  return data.map((assignment) => ({
    ...assignment,
    submission: assignment.submissions[0] ?? null,
  }));
}

/** Chi tiết một bài tập + bài nộp của mình. `null` → trang trả 404. */
export async function getMyAssignmentDetail(assignmentId: string) {
  // `id` đến từ URL: chuỗi rác đi thẳng xuống Postgres sẽ ném lỗi kiểu uuid và
  // trang trả 500 kèm stack thay vì 404.
  if (!z.uuid().safeParse(assignmentId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, class_id, title, instructions, due_at, max_score,
       allow_late_submission, status, published_at,
       class:classes (id, code, name),
       assignment_attachments (id, file_name, size_bytes),
       submissions (
         id, text_answer, submitted_at, is_late, status, score, feedback,
         graded_at, updated_at,
         submission_files (id, file_name, mime_type, size_bytes, created_at)
       )`,
    )
    .eq("id", assignmentId)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`Không tải được bài tập: ${error.message}`);
  if (!data) return null;

  return { ...data, submission: data.submissions[0] ?? null };
}
