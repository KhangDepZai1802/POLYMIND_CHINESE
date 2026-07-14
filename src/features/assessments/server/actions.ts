"use server";

import { revalidatePath } from "next/cache";

import {
  assessmentCreateSchema,
  assessmentResultSchema,
  assessmentUpdateSchema,
} from "@/features/assessments/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function revalidateAssessmentPaths(classId: string, assessmentId?: string) {
  revalidatePath("/teacher/assessments");
  revalidatePath(`/teacher/classes/${classId}`);
  if (assessmentId) revalidatePath(`/teacher/assessments/${assessmentId}`);
}

export async function createAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");
  const parsed = assessmentCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      ...parsed.data,
      // DB ghi đè bằng auth.uid() và ép published_at = null; gửi actor thật ở đây
      // để ý định của app cũng rõ ràng, không phải để DB tin.
      created_by: user.id,
      published_at: null,
    })
    .select("id, class_id, title")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "assessment.create",
    resourceType: "assessment",
    resourceId: data.id,
    after: { title: data.title, class_id: data.class_id },
  });

  revalidateAssessmentPaths(data.class_id);
  return { success: `Đã tạo bài kiểm tra “${data.title}” (chưa công bố).` };
}

export async function updateAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");

  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài kiểm tra." };
  }

  const parsed = assessmentUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("assessments")
    .select("title, type, assessment_date, max_score")
    .eq("id", id)
    .eq("class_id", classId)
    .maybeSingle();

  if (!before) return { error: "Không tìm thấy bài kiểm tra." };

  const { data, error } = await supabase
    .from("assessments")
    .update(parsed.data)
    .eq("id", id)
    .eq("class_id", classId)
    .select("id, title")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "assessment.update",
    resourceType: "assessment",
    resourceId: id,
    before,
    after: parsed.data,
  });

  revalidateAssessmentPaths(classId, data.id);
  return { success: "Đã lưu thay đổi bài kiểm tra." };
}

export async function deleteAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài kiểm tra." };
  }

  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("title, published_at")
    .eq("id", id)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assessment) return { error: "Không tìm thấy bài kiểm tra." };
  if (assessment.published_at) {
    return {
      error: "Bài kiểm tra đã công bố kết quả nên không thể xóa.",
    };
  }

  const { error } = await supabase.from("assessments").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "assessment.delete",
    resourceType: "assessment",
    resourceId: id,
    before: { title: assessment.title },
  });

  revalidateAssessmentPaths(classId);
  return { success: `Đã xóa bài kiểm tra “${assessment.title}”.` };
}

export async function saveAssessmentResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const parsed = assessmentResultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { assessment_id, class_id, enrollment_id, feedback, ...scores } =
    parsed.data;

  const supabase = await createClient();
  // RPC là đường ghi duy nhất: quyền, ràng buộc thang điểm, actor và chống trùng
  // đều ở DB. INSERT/UPDATE trực tiếp vào assessment_results đã bị thu hồi.
  const { error } = await supabase.rpc("save_assessment_result", {
    p_assessment_id: assessment_id,
    p_enrollment_id: enrollment_id,
    p_overall_score: scores.overall_score ?? undefined,
    p_listening_score: scores.listening_score ?? undefined,
    p_speaking_score: scores.speaking_score ?? undefined,
    p_reading_score: scores.reading_score ?? undefined,
    p_writing_score: scores.writing_score ?? undefined,
    p_vocabulary_score: scores.vocabulary_score ?? undefined,
    p_grammar_score: scores.grammar_score ?? undefined,
    p_feedback: feedback ?? undefined,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidateAssessmentPaths(class_id, assessment_id);
  return { success: "Đã lưu điểm." };
}

export async function publishAssessmentResultsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài kiểm tra." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_assessment_results", {
    p_assessment_id: id,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidateAssessmentPaths(classId, id);
  return {
    success:
      data && data > 0
        ? `Đã công bố kết quả cho ${data} học viên và gửi thông báo.`
        : "Không có kết quả mới để công bố; các kết quả trước đó vẫn được giữ.",
  };
}
