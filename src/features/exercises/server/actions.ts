"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import {
  clearSpeakingAnswer,
  persistSpeakingAnswer,
} from "@/features/assessment-results/server/speaking-upload";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const deliverySchema = z.object({
  class_ids: z.array(z.uuid()).min(1, "Chọn ít nhất một lớp"),
  set_version_id: z.uuid(),
  title: z.string().trim().min(2),
  available_from: z.string().min(1),
  due_at: z.string().min(1),
  attempt_limit: z.coerce.number().int().min(1).max(20),
  allow_late: z.string().optional(),
  late_penalty: z.coerce.number().min(0).max(100).default(0),
  grading_method: z.enum(["first", "latest", "highest"]),
  result_release_mode: z.enum(["manual", "after_graded", "after_due"]),
  answer_release_mode: z.enum([
    "never",
    "after_submit",
    "after_due",
    "with_results",
  ]),
});
const gradeSchema = z.object({
  answer_id: z.uuid(),
  score: z.coerce.number().min(0),
  feedback: z.string().trim().max(2000).default(""),
  override_reason: z.string().trim().max(500).default(""),
  delivery_id: z.uuid(),
});

export async function createExerciseDeliveryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = deliverySchema.safeParse({
    ...Object.fromEntries(formData),
    class_ids: formData.getAll("class_ids"),
  });
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { data: setVersion, error: setVersionError } = await supabase
    .from("question_set_versions")
    .select("raw_max_score")
    .eq("id", parsed.data.set_version_id)
    .not("locked_at", "is", null)
    .single();
  if (setVersionError || !setVersion || setVersion.raw_max_score <= 0) {
    return { error: "Bộ bài tập chưa khóa hoặc chưa có tổng điểm hợp lệ." };
  }
  const { data, error } = await supabase.rpc(
    "create_multi_class_exercise_deliveries",
    {
      p_class_ids: parsed.data.class_ids,
      p_set_version_id: parsed.data.set_version_id,
      p_title: parsed.data.title,
      p_available_from: fromZonedTime(
        parsed.data.available_from,
        "Asia/Ho_Chi_Minh",
      ).toISOString(),
      p_due_at: fromZonedTime(
        parsed.data.due_at,
        "Asia/Ho_Chi_Minh",
      ).toISOString(),
      p_max_score: setVersion.raw_max_score,
      p_attempt_limit: parsed.data.attempt_limit,
      p_allow_late: parsed.data.allow_late === "on",
      p_late_penalty: parsed.data.late_penalty,
      p_publish: formData.get("publish") === "true",
    },
  );
  if (error) return { error: error.message };
  const ids = data ?? [];
  if (ids.length > 0) {
    const configured = await supabase
      .from("exercise_deliveries")
      .update({
        grading_method: parsed.data.grading_method,
        result_release_mode: parsed.data.result_release_mode,
        answer_release_mode: parsed.data.answer_release_mode,
      })
      .in("id", ids);
    if (configured.error) return { error: configured.error.message };
  }
  revalidatePath("/teacher/exercises");
  return {
    success: `Đã tạo ${ids.length || parsed.data.class_ids.length} lần giao riêng.`,
  };
}

export async function startExerciseAction(formData: FormData) {
  await requireRole("student");
  const id = formData.get("delivery_id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_exercise_attempt", {
    p_delivery_id: id,
  });
  if (error) throw new Error(error.message);
  redirect(`/student/exercises/${id}/attempt/${data}`);
}

export async function saveExerciseAnswer(
  attemptId: string,
  itemId: string,
  payload: unknown,
) {
  await requireRole("student");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_exercise_answer", {
    p_attempt_id: attemptId,
    p_set_item_id: itemId,
    p_answer_payload: payload as Json,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, savedAt: data };
}

export async function uploadExerciseSpeakingAnswer(
  attemptId: string,
  itemId: string,
  formData: FormData,
) {
  const actor = await requireRole("student");
  return persistSpeakingAnswer(
    "exercise",
    actor.id,
    attemptId,
    itemId,
    formData,
  );
}

export async function deleteExerciseSpeakingAnswer(
  attemptId: string,
  itemId: string,
) {
  await requireRole("student");
  return clearSpeakingAnswer("exercise", attemptId, itemId);
}

export async function submitExerciseAttempt(attemptId: string) {
  await requireRole("student");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exercise_attempt", {
    p_attempt_id: attemptId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/student/exercises");
  return { ok: true, status: data };
}

export async function publishExerciseResultsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const id = formData.get("delivery_id");
  if (typeof id !== "string") return { error: "Thiếu lần giao." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_exercise_results", {
    p_delivery_id: id,
  });
  if (error) return { error: error.message };
  revalidatePath("/teacher/exercises");
  return { success: `Đã công bố ${data} kết quả.` };
}

export async function gradeExerciseAnswerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = gradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("grade_exercise_answer", {
    p_answer_id: parsed.data.answer_id,
    p_score: parsed.data.score,
    p_feedback: parsed.data.feedback || undefined,
    p_override_reason: parsed.data.override_reason || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath(`/teacher/exercises/${parsed.data.delivery_id}`);
  revalidatePath("/teacher/exercises");
  return { success: "Đã lưu điểm câu trả lời." };
}
