"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import { isSameVietnamDate } from "@/features/exams/domain/time";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const schema = z.object({
  class_id: z.uuid(),
  set_version_id: z.uuid(),
  title: z.string().trim().min(2),
  exam_type: z.enum([
    "quiz",
    "midterm",
    "final",
    "mock_hsk",
    "speaking",
    "custom",
  ]),
  opens_at: z.string().min(1),
  closes_at: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive(),
  passing_score: z
    .union([z.literal(""), z.coerce.number().min(0).max(100)])
    .optional(),
  answer_release_mode: z.enum(["never", "with_results"]).default("never"),
});
const gradeSchema = z.object({
  answer_id: z.uuid(),
  score: z.coerce.number().min(0),
  feedback: z.string().trim().max(2000).default(""),
  override_reason: z.string().trim().max(500).default(""),
  delivery_id: z.uuid(),
});
export async function createExamDeliveryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const opens = fromZonedTime(parsed.data.opens_at, "Asia/Ho_Chi_Minh"),
    closes = fromZonedTime(parsed.data.closes_at, "Asia/Ho_Chi_Minh");
  if (!isSameVietnamDate(opens, closes))
    return { error: "Giờ mở và đóng phải trong cùng một ngày Việt Nam." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_exam_delivery", {
    p_class_id: parsed.data.class_id,
    p_set_version_id: parsed.data.set_version_id,
    p_title: parsed.data.title,
    p_exam_type: parsed.data.exam_type,
    p_opens_at: opens.toISOString(),
    p_closes_at: closes.toISOString(),
    p_duration_minutes: parsed.data.duration_minutes,
    p_passing_score:
      parsed.data.passing_score === "" ? undefined : parsed.data.passing_score,
  });
  if (error) return { error: error.message };
  if (data) {
    const publish = await supabase.rpc("publish_exam_delivery", {
      p_delivery_id: data,
    });
    if (publish.error) return { error: publish.error.message };
    const configured = await supabase.from("exam_deliveries").update({ answer_release_mode: parsed.data.answer_release_mode }).eq("id", data);
    if (configured.error) return { error: configured.error.message };
  }
  revalidatePath("/teacher/exams");
  return { success: "Đã lên lịch kỳ thi." };
}
export async function startExamAction(formData: FormData) {
  await requireRole("student");
  const id = formData.get("delivery_id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_exam_attempt", {
    p_exam_delivery_id: id,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("Không tạo được lượt thi");
  redirect(`/student/exams/${id}/attempt/${row.attempt_id}`);
}
export async function saveExamAnswer(
  attemptId: string,
  itemId: string,
  payload: unknown,
) {
  await requireRole("student");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_exam_answer", {
    p_attempt_id: attemptId,
    p_set_item_id: itemId,
    p_answer_payload: payload as Json,
  });
  return error
    ? { ok: false, error: error.message }
    : { ok: true, savedAt: data };
}
export async function submitExamAttempt(
  attemptId: string,
  reason:
    | "manual"
    | "duration_expired"
    | "exam_window_closed"
    | "system_finalize" = "manual",
) {
  await requireRole("student");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exam_attempt", {
    p_attempt_id: attemptId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/student/exams");
  return { ok: true, status: data };
}
export async function logExamEvent(
  attemptId: string,
  eventType: string,
  context: Record<string, unknown> = {},
) {
  await requireRole("student");
  const supabase = await createClient();
  await supabase.rpc("log_exam_integrity_event", {
    p_attempt_id: attemptId,
    p_event_type: eventType,
    p_context: context as Json,
  });
}

export async function gradeExamAnswerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = gradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("grade_exam_answer", {
    p_answer_id: parsed.data.answer_id,
    p_score: parsed.data.score,
    p_feedback: parsed.data.feedback || undefined,
    p_override_reason: parsed.data.override_reason || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath(`/teacher/exams/${parsed.data.delivery_id}`);
  revalidatePath("/teacher/exams");
  return { success: "Đã lưu điểm câu trả lời." };
}

export async function publishExamResultsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const id = formData.get("delivery_id");
  if (typeof id !== "string") return { error: "Thiếu kỳ thi." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_exam_results", {
    p_delivery_id: id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/teacher/exams/${id}`);
  revalidatePath("/teacher/exams");
  return { success: `Đã công bố kết quả (${data ?? 0}).` };
}

export async function lockExamResultsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("teacher", "super_admin"); const id=formData.get("delivery_id"); if(typeof id!=="string") return{error:"Thiếu kỳ thi."};
  const supabase=await createClient(); const {error}=await supabase.rpc("lock_exam_results",{p_delivery_id:id}); if(error)return{error:error.message};
  revalidatePath(`/teacher/exams/${id}`); return{success:"Đã khóa điểm. Có thể công bố kết quả."};
}

export async function runExamRegradeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const id = formData.get("delivery_id");
  const reason = formData.get("reason");
  if (typeof id !== "string" || typeof reason !== "string" || !reason.trim()) {
    return { error: "Phải nhập lý do chấm lại." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("run_exam_regrade", {
    p_delivery_id: id,
    p_reason: reason,
    p_rule_override: {},
  });
  if (error) return { error: error.message };
  revalidatePath(`/teacher/exams/${id}`);
  return { success: "Đã chấm lại và ghi audit trước/sau." };
}
