"use server";

import { revalidatePath } from "next/cache";

import {
  evaluationCreateSchema,
  evaluationUpdateSchema,
  noteCreateSchema,
} from "@/features/evaluations/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function revalidateEvaluationPaths(enrollmentId: string) {
  revalidatePath("/teacher/evaluations");
  revalidatePath(`/teacher/evaluations/${enrollmentId}`);
}

export async function createEvaluationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");
  const parsed = evaluationCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_evaluations")
    .insert({
      ...parsed.data,
      // DB ghi đè bằng auth.uid() và ép về nháp; gửi actor thật để ý định rõ ràng.
      created_by: user.id,
      published_at: null,
      visible_to_student: false,
    })
    .select("id, enrollment_id")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "evaluation.create",
    resourceType: "learning_evaluation",
    resourceId: data.id,
    after: { enrollment_id: data.enrollment_id },
  });

  revalidateEvaluationPaths(data.enrollment_id);
  return { success: "Đã lưu bản đánh giá (chưa gửi cho học viên)." };
}

export async function updateEvaluationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");

  const id = formData.get("id");
  const enrollmentId = formData.get("enrollment_id");
  if (typeof id !== "string" || typeof enrollmentId !== "string") {
    return { error: "Thiếu thông tin đánh giá." };
  }

  const parsed = evaluationUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("learning_evaluations")
    .update(parsed.data)
    .eq("id", id)
    .eq("enrollment_id", enrollmentId);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "evaluation.update",
    resourceType: "learning_evaluation",
    resourceId: id,
    after: { evaluation_date: parsed.data.evaluation_date },
  });

  revalidateEvaluationPaths(enrollmentId);
  return { success: "Đã lưu thay đổi đánh giá." };
}

export async function publishEvaluationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const enrollmentId = formData.get("enrollment_id");
  if (typeof id !== "string" || typeof enrollmentId !== "string") {
    return { error: "Thiếu thông tin đánh giá." };
  }

  const supabase = await createClient();
  // RPC đặt CẢ published_at và visible_to_student cùng lúc — không có đường nào
  // bật một cột rồi quên cột kia.
  const { error } = await supabase.rpc("publish_evaluation", {
    p_evaluation_id: id,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidateEvaluationPaths(enrollmentId);
  return { success: "Đã gửi đánh giá cho học viên và thông báo." };
}

export async function deleteEvaluationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const enrollmentId = formData.get("enrollment_id");
  if (typeof id !== "string" || typeof enrollmentId !== "string") {
    return { error: "Thiếu thông tin đánh giá." };
  }

  const supabase = await createClient();
  const { data: evaluation } = await supabase
    .from("learning_evaluations")
    .select("published_at")
    .eq("id", id)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (!evaluation) return { error: "Không tìm thấy đánh giá." };
  if (evaluation.published_at) {
    return { error: "Đánh giá đã gửi cho học viên nên không thể xóa." };
  }

  const { error } = await supabase
    .from("learning_evaluations")
    .delete()
    .eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "evaluation.delete",
    resourceType: "learning_evaluation",
    resourceId: id,
  });

  revalidateEvaluationPaths(enrollmentId);
  return { success: "Đã xóa bản đánh giá nháp." };
}

export async function createNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");
  const parsed = noteCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_notes")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id, enrollment_id, visibility")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "note.create",
    resourceType: "student_note",
    resourceId: data.id,
    after: { enrollment_id: data.enrollment_id, visibility: data.visibility },
  });

  revalidateEvaluationPaths(data.enrollment_id);
  return {
    success:
      data.visibility === "staff_only"
        ? "Đã lưu ghi chú nội bộ — học viên không đọc được."
        : "Đã lưu ghi chú và chia sẻ với học viên.",
  };
}

export async function deleteNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const enrollmentId = formData.get("enrollment_id");
  if (typeof id !== "string" || typeof enrollmentId !== "string") {
    return { error: "Thiếu thông tin ghi chú." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_notes")
    .delete()
    .eq("id", id)
    .eq("enrollment_id", enrollmentId);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "note.delete",
    resourceType: "student_note",
    resourceId: id,
  });

  revalidateEvaluationPaths(enrollmentId);
  return { success: "Đã xóa ghi chú." };
}
