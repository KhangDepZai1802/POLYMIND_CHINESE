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
import {
  isOwnedQuestionAudioPath,
  MAX_QUESTION_AUDIO_BYTES,
  QUESTION_AUDIO_BUCKET,
  questionAudioFormat,
} from "@/features/question-bank/domain/audio";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const saveQuestionSchema = z.object({
  mode: z.enum(["create", "version"]),
  question_id: z.string().uuid().optional(),
  source_version_id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Nhập tiêu đề nội bộ"),
  skill: z.enum(QUESTION_SKILLS),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_type: z.enum(QUESTION_TYPES),
  prompt_text: z.string().trim().min(1, "Nhập nội dung câu hỏi"),
  explanation_text: z.string().trim().optional().default(""),
});

type QuestionAudioUploadTicket = {
  path: string;
  token: string;
  contentType: "audio/mpeg" | "audio/mp4";
};

/**
 * Cấp vé upload ngắn hạn để browser gửi MP3/M4A thẳng tới Supabase Storage.
 * File không đi qua Server Action (mặc định Next chỉ nhận 1 MB và Vercel cũng
 * giới hạn request), nhưng URL vẫn được ký bằng session thật và chịu Storage RLS.
 */
export async function createQuestionAudioUploadUrlAction(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ error: string } | QuestionAudioUploadTicket> {
  const actor = await requireRole("teacher", "super_admin");
  const format = questionAudioFormat(input.fileName, input.mimeType);
  if (!format) return { error: "Audio chỉ nhận file MP3 hoặc M4A hợp lệ." };

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "File audio rỗng hoặc không đọc được." };
  }
  if (input.sizeBytes > MAX_QUESTION_AUDIO_BYTES) {
    return { error: "Audio tối đa 50 MB." };
  }

  // Path do server sinh. Client chỉ nhận path sau khi đã qua auth + allowlist.
  const path = `${actor.id}/${crypto.randomUUID()}.${format.extension}`;
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "question_media"))) {
    return {
      error: "Bạn đã tạo quá nhiều lượt tải audio. Vui lòng thử lại sau.",
    };
  }

  const { data, error } = await supabase.storage
    .from(QUESTION_AUDIO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { error: "Không tạo được liên kết tải audio. Vui lòng thử lại." };
  }

  return { path: data.path, token: data.token, contentType: format.mimeType };
}

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
    source_version_id: formData.get("source_version_id") || undefined,
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

  const needsAudio = AUDIO_QUESTION_TYPES.includes(input.question_type);
  const rawAudioObjectPath = formData.get("audio_object_path");
  const audioObjectPath =
    typeof rawAudioObjectPath === "string" && rawAudioObjectPath.length > 0
      ? rawAudioObjectPath
      : null;
  const canReuseAudio =
    input.mode === "version" && Boolean(input.source_version_id);
  if (needsAudio && !audioObjectPath && !canReuseAudio) {
    return { error: "Dạng câu Nghe cần một file audio (MP3/M4A)." };
  }
  if (!needsAudio && audioObjectPath) {
    return { error: "Dạng câu này không sử dụng audio đề bài." };
  }

  const supabase = await createClient();

  // Path đi vòng qua browser nên phải coi là dữ liệu không tin cậy: bắt buộc
  // đúng namespace actor và kiểm tra file thật trong Storage trước khi ghi DB.
  let preparedMedia: {
    object_path: string;
    mime_type: "audio/mpeg" | "audio/mp4";
    size_bytes: number;
    duration_ms: number | null;
  } | null = null;
  if (audioObjectPath) {
    if (!isOwnedQuestionAudioPath(audioObjectPath, actor.id)) {
      return { error: "Đường dẫn audio không hợp lệ." };
    }
    const { data: existingMedia, error: existingMediaError } = await supabase
      .from("question_media")
      .select("id")
      .eq("object_path", audioObjectPath)
      .maybeSingle();
    if (existingMediaError || existingMedia) {
      return { error: "File audio này đã được gắn vào một câu hỏi." };
    }
    const { data: info, error: infoError } = await supabase.storage
      .from(QUESTION_AUDIO_BUCKET)
      .info(audioObjectPath);
    const format = questionAudioFormat(audioObjectPath, info?.contentType);
    const sizeBytes = info?.size;
    if (
      infoError ||
      !info ||
      !format ||
      typeof sizeBytes !== "number" ||
      sizeBytes <= 0 ||
      sizeBytes > MAX_QUESTION_AUDIO_BYTES
    ) {
      await supabase.storage
        .from(QUESTION_AUDIO_BUCKET)
        .remove([audioObjectPath]);
      return {
        error: "Không xác minh được file audio vừa tải lên. Hãy chọn lại file.",
      };
    }
    preparedMedia = {
      object_path: audioObjectPath,
      mime_type: format.mimeType,
      size_bytes: sizeBytes,
      duration_ms: null,
    };
  }

  // 1) Xác định question: tạo mới hoặc dùng câu đang sở hữu.
  let questionId: string;
  let questionCode: string | null = null;
  let createdQuestion = false;
  let previousQuestion: {
    current_version_id: string | null;
    title: string;
    skill: (typeof QUESTION_SKILLS)[number];
    difficulty: "easy" | "medium" | "hard";
    status: string;
  } | null = null;
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
    if (error || !data) {
      if (preparedMedia) {
        await supabase.storage
          .from(QUESTION_AUDIO_BUCKET)
          .remove([preparedMedia.object_path]);
      }
      return { error: "Không tạo được câu hỏi." };
    }
    questionId = data.id;
    questionCode = data.code;
    createdQuestion = true;
  } else {
    questionId = input.question_id!;
    const { data, error } = await supabase
      .from("questions")
      .select("current_version_id,title,skill,difficulty,status")
      .eq("id", questionId)
      .maybeSingle();
    if (error || !data) {
      if (preparedMedia) {
        await supabase.storage
          .from(QUESTION_AUDIO_BUCKET)
          .remove([preparedMedia.object_path]);
      }
      return { error: "Không tìm thấy câu hỏi để chỉnh sửa." };
    }
    previousQuestion = data;
  }

  let versionId: string | null = null;
  let uploadedObjectPath: string | null = preparedMedia?.object_path ?? null;
  const rollback = async () => {
    if (versionId && uploadedObjectPath) {
      await supabase
        .from("question_media")
        .delete()
        .eq("question_version_id", versionId);
    }
    if (uploadedObjectPath) {
      await supabase.storage
        .from(QUESTION_AUDIO_BUCKET)
        .remove([uploadedObjectPath]);
    }
    if (createdQuestion) {
      await supabase.from("questions").delete().eq("id", questionId);
    } else if (previousQuestion && versionId) {
      await supabase
        .from("questions")
        .update({
          current_version_id: previousQuestion.current_version_id,
          title: previousQuestion.title,
          skill: previousQuestion.skill,
          difficulty: previousQuestion.difficulty,
          status: previousQuestion.status as "draft" | "ready",
        })
        .eq("id", questionId);
      await supabase.from("question_versions").delete().eq("id", versionId);
    }
  };

  let reusableMedia: {
    object_path: string;
    mime_type: string;
    size_bytes: number;
    duration_ms: number | null;
  } | null = null;
  if (needsAudio && !preparedMedia && input.source_version_id) {
    const { data: sourceVersion } = await supabase
      .from("question_versions")
      .select("id")
      .eq("id", input.source_version_id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (!sourceVersion) {
      return { error: "Audio cũ không thuộc câu hỏi đang chỉnh sửa." };
    }
    const { data: sourceMedia, error: sourceMediaError } = await supabase
      .from("question_media")
      .select("object_path,mime_type,size_bytes,duration_ms")
      .eq("question_version_id", sourceVersion.id)
      .eq("media_role", "prompt_audio")
      .maybeSingle();
    if (sourceMediaError || !sourceMedia) {
      return { error: "Không tìm thấy audio cũ. Hãy chọn lại file audio." };
    }
    reusableMedia = sourceMedia;
  }

  // 2) Tạo version bất biến (RPC trả về version id, đồng thời set current_version_id).
  const { data: createdVersionId, error: versionError } = await supabase.rpc(
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
  if (versionError || !createdVersionId) {
    await rollback();
    return {
      error: versionError?.message ?? "Không lưu được phiên bản câu hỏi.",
    };
  }
  versionId = String(createdVersionId);

  // 3) Gắn audio đã upload trực tiếp. Khi giữ audio cũ, Storage tự copy nội
  // bộ sang path mới; không kéo file qua Server Action/Vercel.
  let mediaToLink = preparedMedia;
  if (!mediaToLink && reusableMedia) {
    const format = questionAudioFormat(
      reusableMedia.object_path,
      reusableMedia.mime_type,
    );
    if (!format) {
      await rollback();
      return { error: "Audio cũ không còn đúng định dạng MP3/M4A." };
    }
    const objectPath = `${actor.id}/${versionId}/${crypto.randomUUID()}.${format.extension}`;
    const copied = await supabase.storage
      .from(QUESTION_AUDIO_BUCKET)
      .copy(reusableMedia.object_path, objectPath);
    if (copied.error) {
      await rollback();
      return {
        error: "Không sao chép được audio cũ. Hãy chọn lại file audio.",
      };
    }
    uploadedObjectPath = objectPath;
    mediaToLink = {
      object_path: objectPath,
      mime_type: format.mimeType,
      size_bytes: reusableMedia.size_bytes,
      duration_ms: reusableMedia.duration_ms,
    };
  }

  if (mediaToLink) {
    const linked = await supabase.from("question_media").insert({
      question_version_id: versionId,
      media_role: "prompt_audio",
      object_path: mediaToLink.object_path,
      mime_type: mediaToLink.mime_type,
      size_bytes: mediaToLink.size_bytes,
      duration_ms: mediaToLink.duration_ms,
      uploaded_by: actor.id,
    });
    if (linked.error) {
      // Nếu một request đồng thời đã gắn cùng path trước, tuyệt đối không xóa
      // object mà request thắng đang dùng.
      const { data: racedMedia } = await supabase
        .from("question_media")
        .select("id")
        .eq("object_path", mediaToLink.object_path)
        .maybeSingle();
      if (racedMedia) uploadedObjectPath = null;
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

  if (input.mode === "version") {
    const { data: updatedQuestion, error: updateQuestionError } = await supabase
      .from("questions")
      .update({
        title: input.title,
        skill: input.skill,
        difficulty: input.difficulty,
      })
      .eq("id", questionId)
      .select("id")
      .maybeSingle();
    if (updateQuestionError || !updatedQuestion) {
      await rollback();
      return { error: "Không cập nhật được thông tin câu hỏi." };
    }
  }

  revalidatePath("/teacher/exercises/question-bank");
  revalidatePath("/teacher/exams/question-bank");
  return {
    success:
      input.mode === "create"
        ? `Đã tạo câu hỏi ${questionCode ?? ""}.`.trim()
        : "Đã lưu chỉnh sửa. Câu hỏi trong ngân hàng đã được cập nhật.",
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
