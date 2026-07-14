"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  submissionFileRegisterSchema,
  submitAssignmentSchema,
} from "@/features/submissions/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_ASSIGNMENT_FILE_SIZE_BYTES,
  SUBMISSIONS_BUCKET,
  fileExtension,
} from "@/lib/domain/files";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Enrollment của người đang đăng nhập — **lấy ở server, không nhận từ form**.
 *
 * Nếu để client gửi `enrollment_id` lên thì học viên A có thể nộp bài dưới danh
 * nghĩa học viên B. RLS (`app.owns_enrollment`) vẫn chặn được, nhưng không có lý
 * do gì để mở một tham số nguy hiểm rồi trông cậy vào lưới sau cùng.
 */
async function getMyOpenEnrollment(supabase: Client) {
  const { data } = await supabase
    .from("enrollments")
    .select("id, class_id")
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();

  return data;
}

function revalidateAssignment(assignmentId: string) {
  revalidatePath("/student");
  revalidatePath("/student/assignments");
  revalidatePath(`/student/assignments/${assignmentId}`);
}

/**
 * Nộp bài / cập nhật bài làm.
 *
 * DB (migration 26) quyết định `submitted_at`, `is_late`, `status`, `attempt_no` —
 * client không khai được. Bài đã chấm thì trigger chặn sửa nội dung.
 */
export async function submitAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");
  const parsed = submitAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { assignment_id, text_answer } = parsed.data;
  const supabase = await createClient();

  const enrollment = await getMyOpenEnrollment(supabase);
  if (!enrollment) return { error: "Bạn chưa được xếp lớp." };

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, graded_at")
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  if (existing) {
    if (existing.graded_at) {
      return { error: "Bài đã được chấm nên không sửa được nữa." };
    }

    const { error } = await supabase
      .from("submissions")
      .update({ text_answer })
      .eq("id", existing.id);

    if (error) return { error: dbErrorToMessage(error) };
    revalidateAssignment(assignment_id);
    return { success: "Đã cập nhật bài làm." };
  }

  const { error } = await supabase.from("submissions").insert({
    assignment_id,
    enrollment_id: enrollment.id,
    text_answer,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidateAssignment(assignment_id);
  return { success: "Đã nộp bài." };
}

/**
 * Tạo bài nộp rỗng để có `submission_id` trước khi upload file.
 *
 * File nằm ở `{class_id}/{submission_id}/...` nên bắt buộc phải có submission
 * trước. Trả `submissionId` cho client upload rồi gọi `registerSubmissionFile`.
 */
export async function ensureSubmissionAction(
  assignmentId: string,
): Promise<{ error: string } | { submissionId: string; classId: string }> {
  await requireRole("student");
  if (!z.uuid().safeParse(assignmentId).success) {
    return { error: "Bài tập không hợp lệ." };
  }

  const supabase = await createClient();
  const enrollment = await getMyOpenEnrollment(supabase);
  if (!enrollment) return { error: "Bạn chưa được xếp lớp." };

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, graded_at")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (existing) {
    if (existing.graded_at) {
      return { error: "Bài đã được chấm nên không thêm tệp được nữa." };
    }
    return { submissionId: existing.id, classId: enrollment.class_id };
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert({ assignment_id: assignmentId, enrollment_id: enrollment.id })
    .select("id")
    .single();

  if (error) return { error: dbErrorToMessage(error) };
  return { submissionId: data.id, classId: enrollment.class_id };
}

export async function createSubmissionUploadUrlAction(input: {
  submissionId: string;
  classId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<{ error: string } | { path: string; token: string }> {
  await requireRole("student");

  if (
    !z.uuid().safeParse(input.submissionId).success ||
    !z.uuid().safeParse(input.classId).success
  ) {
    return { error: "Bài nộp không hợp lệ." };
  }

  const ext = fileExtension(input.fileName);
  if (!ext) {
    return {
      error: `Định dạng không được hỗ trợ. Cho phép: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`,
    };
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "Tệp rỗng hoặc không đọc được." };
  }
  if (input.sizeBytes > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
    return { error: "Tệp vượt quá 20 MB." };
  }

  const supabase = await createClient();
  // RLS: chỉ đọc được submission của chính mình → không ký được URL cho bài người khác.
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, graded_at")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (!submission) return { error: "Không tìm thấy bài nộp của bạn." };
  if (submission.graded_at) return { error: "Bài đã được chấm." };

  const path = `${input.classId}/${input.submissionId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: "Không tạo được liên kết tải lên. Vui lòng thử lại." };
  }

  return { path: data.path, token: data.token };
}

export async function registerSubmissionFileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");
  const parsed = submissionFileRegisterSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const { submission_id, assignment_id, object_path, file_name } = parsed.data;
  const supabase = await createClient();

  const { data: info, error: infoError } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .info(object_path);
  if (infoError || !info) {
    return { error: "Không tìm thấy tệp vừa tải lên. Vui lòng thử lại." };
  }

  const sizeBytes = info.size ?? 0;
  if (sizeBytes <= 0 || sizeBytes > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
    await supabase.storage.from(SUBMISSIONS_BUCKET).remove([object_path]);
    return {
      error:
        sizeBytes <= 0 ? "Tệp rỗng hoặc không đọc được." : "Tệp vượt quá 20 MB.",
    };
  }

  // Trigger `enforce_submission_file_path` (migration 26) là chốt cuối: path phải
  // đúng `{class_id}/{submission_id}/...` của chính submission này.
  const { error } = await supabase.from("submission_files").insert({
    submission_id,
    object_path,
    file_name,
    mime_type: info.contentType ?? null,
    size_bytes: sizeBytes,
  });

  if (error) {
    await supabase.storage.from(SUBMISSIONS_BUCKET).remove([object_path]);
    return { error: dbErrorToMessage(error) };
  }

  revalidateAssignment(assignment_id);
  return { success: `Đã đính kèm “${file_name}”.` };
}

export async function deleteSubmissionFileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");
  const id = formData.get("id");
  const assignmentId = formData.get("assignment_id");
  if (typeof id !== "string" || typeof assignmentId !== "string") {
    return { error: "Thiếu thông tin tệp." };
  }

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("submission_files")
    .select("file_name, object_path")
    .eq("id", id)
    .maybeSingle();

  if (!file) return { error: "Không tìm thấy tệp." };

  // RLS `học viên xóa file bài nộp chưa chấm` chặn khi bài đã chấm → xóa 0 dòng.
  const { error } = await supabase
    .from("submission_files")
    .delete()
    .eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  const { error: storageError } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .remove([file.object_path]);
  if (storageError) {
    console.error(
      "[storage] xóa file bài nộp thất bại:",
      file.object_path,
      storageError.message,
    );
  }

  revalidateAssignment(assignmentId);
  return { success: `Đã xóa tệp “${file.file_name}”.` };
}
