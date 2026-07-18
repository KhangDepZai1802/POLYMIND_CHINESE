"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildStructuredPayload,
  structuredContentSchema,
  AUDIO_QUESTION_TYPES,
  QUESTION_SKILLS,
  QUESTION_TYPES,
  type BuiltQuestionPayload,
} from "@/features/question-builder/domain/questions";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const AUDIO_MIME = new Set(["audio/mpeg", "audio/mp4"]);
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const saveQuestionSchema = z.object({
  mode: z.enum(["create", "version"]),
  question_id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Nhập tiêu đề nội bộ"),
  skill: z.enum(QUESTION_SKILLS),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_type: z.enum(QUESTION_TYPES),
  prompt_text: z.string().trim().min(1, "Nhập nội dung câu hỏi"),
  explanation_text: z.string().trim().optional().default(""),
});

/**
 * P-B — điểm ghi duy nhất cho wizard soạn câu hỏi (tạo mới + chỉnh sửa).
 * Tạo question/version → gắn audio question_media (nếu có) → công bố.
 */
export async function saveQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("teacher", "super_admin");

  const parsed = saveQuestionSchema.safeParse({
    mode: formData.get("mode"),
    question_id: formData.get("question_id") || undefined,
    title: formData.get("title"),
    skill: formData.get("skill"),
    difficulty: formData.get("difficulty"),
    question_type: formData.get("question_type"),
    prompt_text: formData.get("prompt_text"),
    explanation_text: formData.get("explanation_text") ?? "",
  });
  if (!parsed.success) return zodToActionState(parsed.error);
  const input = parsed.data;
  if (input.mode === "version" && !input.question_id) {
    return { error: "Thiếu câu hỏi để tạo version." };
  }

  const rawContent = formData.get("content");
  if (typeof rawContent !== "string")
    return { error: "Thiếu nội dung câu hỏi." };
  let contentJson: unknown;
  try {
    contentJson = JSON.parse(rawContent);
  } catch {
    return { error: "Nội dung câu hỏi không hợp lệ." };
  }
  const contentParsed = structuredContentSchema.safeParse(contentJson);
  if (!contentParsed.success) return zodToActionState(contentParsed.error);
  if (contentParsed.data.type !== input.question_type) {
    return { error: "Dạng câu không khớp nội dung." };
  }

  let payload: BuiltQuestionPayload;
  try {
    payload = buildStructuredPayload(contentParsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nội dung không hợp lệ",
    };
  }

  const audio = formData.get("audio");
  const needsAudio = AUDIO_QUESTION_TYPES.includes(input.question_type);
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
  if (needsAudio && !audioFile) {
    return { error: "Dạng câu Nghe cần một file audio (MP3/M4A)." };
  }
  if (audioFile) {
    if (!AUDIO_MIME.has(audioFile.type))
      return { error: "Audio chỉ nhận MP3 hoặc M4A." };
    if (audioFile.size > MAX_AUDIO_BYTES)
      return { error: "Audio tối đa 50 MB." };
  }

  const supabase = await createClient();

  // 1) Xác định question: tạo mới hoặc dùng câu đang sở hữu.
  let questionId: string;
  let questionCode: string | null = null;
  let createdQuestion = false;
  if (input.mode === "create") {
    const { data, error } = await supabase
      .from("questions")
      .insert({
        owner_id: actor.id,
        created_by: actor.id,
        title: input.title,
        skill: input.skill,
        difficulty: input.difficulty,
      })
      .select("id, code")
      .single();
    if (error || !data) return { error: "Không tạo được câu hỏi." };
    questionId = data.id;
    questionCode = data.code;
    createdQuestion = true;
  } else {
    questionId = input.question_id!;
  }

  const rollback = async () => {
    if (createdQuestion)
      await supabase.from("questions").delete().eq("id", questionId);
  };

  // 2) Tạo version bất biến (RPC trả về version id, đồng thời set current_version_id).
  const { data: versionId, error: versionError } = await supabase.rpc(
    "create_question_version",
    {
      p_question_id: questionId,
      p_question_type: input.question_type,
      p_prompt_text: input.prompt_text,
      p_prompt_content: payload.promptContent as Json,
      p_normalization_config: {},
      p_explanation_text: input.explanation_text || undefined,
      p_options: payload.options as Json,
      p_answer_key: payload.answerKey as Json,
      p_grading_config: payload.gradingConfig as Json,
    },
  );
  if (versionError || !versionId) {
    await rollback();
    return {
      error: versionError?.message ?? "Không lưu được phiên bản câu hỏi.",
    };
  }

  // 3) Gắn audio: upload vào bucket private rồi ghi question_media cho version này.
  if (audioFile) {
    const safeName = audioFile.name
      .normalize("NFC")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectPath = `${actor.id}/${String(versionId)}/${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await audioFile.arrayBuffer());
    const uploaded = await supabase.storage
      .from("question-media")
      .upload(objectPath, bytes, {
        contentType: audioFile.type,
        upsert: false,
      });
    if (uploaded.error) {
      await rollback();
      return { error: `Không tải được audio: ${uploaded.error.message}` };
    }
    const linked = await supabase.from("question_media").insert({
      question_version_id: String(versionId),
      media_role: "prompt_audio",
      object_path: objectPath,
      mime_type: audioFile.type,
      size_bytes: audioFile.size,
      uploaded_by: actor.id,
    });
    if (linked.error) {
      await supabase.storage.from("question-media").remove([objectPath]);
      await rollback();
      return { error: `Không lưu được media: ${linked.error.message}` };
    }
  }

  // 4) Công bố version → trạng thái ready.
  const { error: publishError } = await supabase.rpc(
    "publish_question_version",
    {
      p_question_id: questionId,
    },
  );
  if (publishError) {
    await rollback();
    return { error: publishError.message };
  }

  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return {
    success:
      input.mode === "create"
        ? `Đã tạo câu hỏi ${questionCode ?? ""}.`.trim()
        : "Đã cập nhật câu hỏi. Những đề đã giao vẫn giữ nguyên nội dung cũ.",
  };
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
  if (typeof questionId !== "string" || typeof teacherId !== "string")
    return { error: "Thiếu câu hỏi hoặc giáo viên." };
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
  const { error } = await supabase.rpc("clone_question", {
    p_question_id: questionId,
  });
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
  const { error } = await supabase.rpc("submit_question_for_global_review", {
    p_question_id: questionId,
  });
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
  if (
    typeof requestId !== "string" ||
    (decision !== "approve" && decision !== "reject")
  )
    return { error: "Thiếu quyết định duyệt." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_global_question", {
    p_request_id: requestId,
    p_approve: decision === "approve",
    p_reason: typeof reason === "string" ? reason : undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/question-bank-review");
  return {
    success:
      decision === "approve" ? "Đã đưa vào kho chung." : "Đã từ chối yêu cầu.",
  };
}
