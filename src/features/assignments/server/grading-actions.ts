"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { gradeSubmissionSchema } from "@/features/assignments/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole, requireUser } from "@/lib/auth/session";
import {
  SIGNED_URL_TTL_SECONDS,
  SUBMISSIONS_BUCKET,
  fileExtension,
  sanitizeDownloadName,
} from "@/lib/domain/files";
import { createClient } from "@/lib/supabase/server";

export async function gradeSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const parsed = gradeSubmissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { submission_id, assignment_id, class_id, score, feedback } =
    parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("grade_submission", {
    p_submission_id: submission_id,
    p_score: score,
    p_feedback: feedback ?? undefined,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath(`/teacher/assignments/${assignment_id}`);
  revalidatePath(`/teacher/assignments?class=${class_id}`);
  revalidatePath(`/teacher/classes/${class_id}`);
  revalidatePath("/teacher");
  return { success: "Đã lưu điểm và gửi thông báo cho học viên." };
}

export async function getSubmissionFileDownloadUrlAction(
  fileId: string,
): Promise<{ error: string } | { url: string }> {
  await requireUser();
  if (!z.uuid().safeParse(fileId).success) {
    return { error: "Tệp bài nộp không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("submission_files")
    .select("file_name, object_path")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return { error: "Không tìm thấy tệp bài nộp." };

  const ext = fileExtension(file.object_path);
  const baseName = file.file_name.replace(/\.[^.]+$/, "");
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUrl(file.object_path, SIGNED_URL_TTL_SECONDS, {
      download: ext ? sanitizeDownloadName(baseName, ext) : true,
    });

  if (error || !data) {
    return { error: "Không tạo được liên kết tải tệp bài nộp." };
  }

  return { url: data.signedUrl };
}
