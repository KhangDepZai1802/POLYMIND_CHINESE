"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";

import {
  authoringPayload,
  questionAuthoringSchema,
} from "@/features/question-builder/domain/questions";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function createQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("teacher", "super_admin");
  const parsed = questionAuthoringSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  let payload: ReturnType<typeof authoringPayload>;
  try {
    payload = authoringPayload(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nội dung không hợp lệ",
    };
  }

  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      owner_id: actor.id,
      created_by: actor.id,
      title: parsed.data.title,
      skill: parsed.data.skill,
      difficulty: parsed.data.difficulty,
    })
    .select("id, code")
    .single();
  if (error) return { error: "Không tạo được câu hỏi." };

  const { error: versionError } = await supabase.rpc(
    "create_question_version",
    {
      p_question_id: question.id,
      p_question_type: parsed.data.question_type,
      p_prompt_text: parsed.data.prompt_text,
      p_prompt_content: {},
      p_normalization_config: {},
      p_explanation_text: parsed.data.explanation_text || undefined,
      p_options: payload.options,
      p_answer_key: payload.answerKey,
      p_grading_config: payload.gradingConfig,
    },
  );
  if (versionError) {
    await supabase.from("questions").delete().eq("id", question.id);
    return { error: "Không lưu được phiên bản câu hỏi." };
  }

  if (formData.get("publish") === "true") {
    const { error: publishError } = await supabase.rpc(
      "publish_question_version",
      { p_question_id: question.id },
    );
    if (publishError) return { error: publishError.message };
  }

  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return { success: `Đã tạo câu hỏi ${question.code}.` };
}

export async function archiveQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("teacher", "super_admin");
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Thiếu câu hỏi." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({
      status: "archived",
      visibility: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", actor.id);
  if (error) return { error: "Không lưu trữ được câu hỏi." };
  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return { success: "Đã lưu trữ câu hỏi." };
}

export async function shareQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const questionId = formData.get("question_id");
  const teacherId = formData.get("teacher_id");
  if (typeof questionId !== "string" || typeof teacherId !== "string") return { error: "Thiếu câu hỏi hoặc giáo viên." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("share_question", {
    p_question_id: questionId,
    p_teacher_id: teacherId,
    p_permission: "clone",
  });
  if (error) return { error: error.message };
  return { success: "Đã chia sẻ quyền xem và clone." };
}

export async function cloneQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const questionId = formData.get("question_id");
  if (typeof questionId !== "string") return { error: "Thiếu câu hỏi." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clone_question", { p_question_id: questionId });
  if (error) return { error: error.message };
  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return { success: "Đã clone thành câu hỏi riêng." };
}

export async function submitQuestionReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const questionId = formData.get("question_id");
  if (typeof questionId !== "string") return { error: "Thiếu câu hỏi." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_question_for_global_review", { p_question_id: questionId });
  if (error) return { error: error.message };
  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return { success: "Đã gửi Super Admin duyệt kho chung." };
}

export async function reviewQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const requestId = formData.get("request_id");
  const decision = formData.get("decision");
  const reason = formData.get("reason");
  if (typeof requestId !== "string" || (decision !== "approve" && decision !== "reject")) return { error: "Thiếu quyết định duyệt." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_global_question", {
    p_request_id: requestId,
    p_approve: decision === "approve",
    p_reason: typeof reason === "string" ? reason : undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/question-bank-review");
  return { success: decision === "approve" ? "Đã đưa vào kho chung." : "Đã từ chối yêu cầu." };
}

export async function importQuestionsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const rateClient = await createClient();
  const rate = await rateClient.rpc("consume_rate_limit", { p_scope: "question_import" });
  if (rate.error || !rate.data) return { error: "Bạn đã vượt giới hạn import. Vui lòng thử lại sau." };
  const file = formData.get("file");
  const mode = formData.get("mode");
  if (!(file instanceof File) || file.size === 0) return { error: "Chọn file Excel .xlsx." };
  if (file.size > 5 * 1024 * 1024) return { error: "File import tối đa 5 MB." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Chỉ nhận file .xlsx theo template." };

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "Không đọc được file Excel." };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "File không có worksheet." };
  const expected = ["title", "question_type", "skill", "difficulty", "prompt_text", "options", "answer", "explanation"];
  const headers = expected.map((_, index) => sheet.getRow(1).getCell(index + 1).text.trim());
  if (headers.some((header, index) => header !== expected[index])) {
    return { error: `Header phải đúng thứ tự: ${expected.join(", ")}.` };
  }

  const rows: Json[] = [];
  const errors: string[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!row.getCell(1).text.trim()) continue;
    const candidate = {
      title: row.getCell(1).text,
      question_type: row.getCell(2).text,
      skill: row.getCell(3).text,
      difficulty: row.getCell(4).text,
      prompt_text: row.getCell(5).text,
      options_text: row.getCell(6).text.split("|").join("\n"),
      answer_text: row.getCell(7).text.split("|").join("\n"),
      explanation_text: row.getCell(8).text,
    };
    const parsed = questionAuthoringSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push(`Dòng ${rowNumber}: ${parsed.error.issues[0]?.message ?? "không hợp lệ"}`);
      continue;
    }
    try {
      const payload = authoringPayload(parsed.data);
      rows.push({
        title: parsed.data.title,
        question_type: parsed.data.question_type,
        skill: parsed.data.skill,
        difficulty: parsed.data.difficulty,
        prompt_text: parsed.data.prompt_text,
        prompt_content: {},
        normalization_config: {},
        explanation_text: parsed.data.explanation_text,
        options: payload.options,
        answer_key: payload.answerKey,
        grading_config: payload.gradingConfig,
      });
    } catch (error) {
      errors.push(`Dòng ${rowNumber}: ${error instanceof Error ? error.message : "không hợp lệ"}`);
    }
  }
  if (rows.length === 0 && errors.length === 0) return { error: "File không có dòng dữ liệu." };
  if (errors.length > 0) return { error: `Dry-run có ${errors.length} lỗi. ${errors.slice(0, 8).join(" · ")}` };
  if (mode === "dry-run") return { success: `Dry-run đạt: ${rows.length} câu hợp lệ, chưa ghi dữ liệu.` };

  const supabase = rateClient;
  const { data, error } = await supabase.rpc("import_questions", { p_rows: rows as Json });
  if (error) return { error: `Transaction đã rollback: ${error.message}` };
  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  const result = data as { count?: number } | null;
  return { success: `Đã import transaction ${result?.count ?? rows.length} câu.` };
}

export async function createQuestionVersionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = questionAuthoringSchema.safeParse(Object.fromEntries(formData));
  const questionId = formData.get("question_id");
  if (!parsed.success) return zodToActionState(parsed.error);
  if (typeof questionId !== "string") return { error: "Thiếu câu hỏi." };
  let payload: ReturnType<typeof authoringPayload>;
  try { payload = authoringPayload(parsed.data); } catch (error) { return { error: error instanceof Error ? error.message : "Nội dung không hợp lệ" }; }
  const supabase = await createClient();
  const version = await supabase.rpc("create_question_version", {
    p_question_id: questionId,
    p_question_type: parsed.data.question_type,
    p_prompt_text: parsed.data.prompt_text,
    p_prompt_content: {}, p_normalization_config: {},
    p_explanation_text: parsed.data.explanation_text || undefined,
    p_options: payload.options, p_answer_key: payload.answerKey, p_grading_config: payload.gradingConfig,
  });
  if (version.error) return { error: version.error.message };
  const published = await supabase.rpc("publish_question_version", { p_question_id: questionId });
  if (published.error) return { error: published.error.message };
  revalidatePath("/teacher/exercises/question-bank"); revalidatePath("/teacher/exams/question-bank");
  return { success: "Đã tạo và công bố version mới; version cũ vẫn bất biến." };
}
