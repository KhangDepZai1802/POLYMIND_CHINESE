import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ANSWER_AUDIO_BUCKET,
  MAX_SPEAKING_AUDIO_BYTES,
  isOwnedSpeakingAudioPath,
  speakingAudioFormat,
  speakingAudioPathExtension,
  type SpeakingUploadTicket,
} from "@/features/assessment-results/domain/speaking-audio";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AttemptKind = "exercise" | "exam";
type Supabase = SupabaseClient<Database>;

type SpeakingUploadInput = {
  mimeType: string;
  sizeBytes: number;
};

type AttachSpeakingInput = {
  objectPath: string;
  durationMs: number;
};

type UploadResult = { ok: boolean; error?: string };

function hasSpeakingItem(payload: unknown, itemId: string): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return false;
  return items.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as { id?: unknown; question?: unknown };
    if (
      row.id !== itemId ||
      !row.question ||
      typeof row.question !== "object"
    ) {
      return false;
    }
    return (row.question as { type?: unknown }).type === "speaking";
  });
}

async function canUploadSpeakingItem(
  supabase: Supabase,
  kind: AttemptKind,
  attemptId: string,
  itemId: string,
): Promise<boolean> {
  const result =
    kind === "exercise"
      ? await supabase.rpc("get_exercise_attempt_payload", {
          p_attempt_id: attemptId,
        })
      : await supabase.rpc("get_exam_attempt_payload", {
          p_attempt_id: attemptId,
        });
  return !result.error && hasSpeakingItem(result.data, itemId);
}

/**
 * Cấp vé ngắn hạn sau khi xác minh đúng học viên, đúng lượt đang mở và đúng
 * câu Nói. Browser dùng vé này để upload Blob thẳng vào Storage.
 */
export async function createSpeakingAnswerUploadUrl(
  kind: AttemptKind,
  actorId: string,
  attemptId: string,
  itemId: string,
  input: SpeakingUploadInput,
): Promise<SpeakingUploadTicket | { error: string }> {
  const format = speakingAudioFormat(input.mimeType);
  if (!format) return { error: "Định dạng âm thanh không được hỗ trợ." };
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "Bản ghi âm đang rỗng." };
  }
  if (input.sizeBytes > MAX_SPEAKING_AUDIO_BYTES) {
    return { error: "Bản ghi tối đa 25 MB." };
  }

  const objectPath = `${actorId}/${attemptId}/${itemId}/${crypto.randomUUID()}.${format.extension}`;
  if (!isOwnedSpeakingAudioPath(objectPath, actorId, attemptId, itemId)) {
    return { error: "Lượt làm hoặc câu hỏi không hợp lệ." };
  }

  const supabase = await createClient();
  if (!(await canUploadSpeakingItem(supabase, kind, attemptId, itemId))) {
    return { error: "Câu Nói không thuộc lượt đang mở hoặc lượt đã hết hạn." };
  }
  if (!(await consumeRateLimit(supabase, "submission_upload"))) {
    return { error: "Bạn đã tải lên quá nhiều lần. Vui lòng thử lại sau." };
  }

  const { data, error } = await supabase.storage
    .from(ANSWER_AUDIO_BUCKET)
    .createSignedUploadUrl(objectPath);
  if (error || !data) {
    return { error: "Không tạo được liên kết tải bản ghi. Vui lòng thử lại." };
  }
  return { path: data.path, token: data.token, contentType: format.mimeType };
}

/**
 * Xác minh object browser vừa upload rồi gắn atomically vào answer_payload qua
 * RPC `attach_answer_media`. Blob không còn đi qua Server Action.
 */
export async function persistSpeakingAnswer(
  kind: AttemptKind,
  actorId: string,
  attemptId: string,
  itemId: string,
  input: AttachSpeakingInput,
): Promise<UploadResult> {
  if (!isOwnedSpeakingAudioPath(input.objectPath, actorId, attemptId, itemId)) {
    return { ok: false, error: "Đường dẫn bản ghi không hợp lệ." };
  }

  const durationMs =
    Number.isFinite(input.durationMs) && input.durationMs > 0
      ? Math.round(input.durationMs)
      : undefined;
  const supabase = await createClient();
  const { data: prior, error: priorError } = await supabase
    .from("answer_media")
    .select("object_path")
    .eq("attempt_kind", kind)
    .eq("attempt_id", attemptId)
    .eq("set_item_id", itemId)
    .maybeSingle();

  // Retry sau khi request trước đã attach thành công là idempotent, kể cả khi
  // lượt vừa được nộp trong lúc client chưa nhận response.
  if (!priorError && prior?.object_path === input.objectPath) {
    return { ok: true };
  }
  if (priorError) {
    await supabase.storage.from(ANSWER_AUDIO_BUCKET).remove([input.objectPath]);
    return { ok: false, error: "Không kiểm tra được bản ghi hiện tại." };
  }

  const { data: replayed, error: replayError } = await supabase
    .from("answer_media")
    .select("id")
    .eq("object_path", input.objectPath)
    .maybeSingle();
  if (replayError || replayed) {
    return { ok: false, error: "File âm thanh này đã được sử dụng." };
  }

  const { data: info, error: infoError } = await supabase.storage
    .from(ANSWER_AUDIO_BUCKET)
    .info(input.objectPath);
  const format = speakingAudioFormat(info?.contentType ?? "");
  const pathExtension = speakingAudioPathExtension(input.objectPath);
  const sizeBytes = info?.size;
  if (
    infoError ||
    !info ||
    !format ||
    format.extension !== pathExtension ||
    typeof sizeBytes !== "number" ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_SPEAKING_AUDIO_BYTES
  ) {
    await supabase.storage.from(ANSWER_AUDIO_BUCKET).remove([input.objectPath]);
    return {
      ok: false,
      error: "Không xác minh được bản ghi vừa tải lên. Hãy thử thu lại.",
    };
  }

  const { error: rpcError } = await supabase.rpc("attach_answer_media", {
    p_kind: kind,
    p_attempt_id: attemptId,
    p_set_item_id: itemId,
    p_object_path: input.objectPath,
    p_mime: format.mimeType,
    p_size: sizeBytes,
    p_duration_ms: durationMs,
  });
  if (rpcError) {
    await supabase.storage.from(ANSWER_AUDIO_BUCKET).remove([input.objectPath]);
    return { ok: false, error: rpcError.message };
  }

  if (prior?.object_path && prior.object_path !== input.objectPath) {
    await supabase.storage
      .from(ANSWER_AUDIO_BUCKET)
      .remove([prior.object_path]);
  }
  return { ok: true };
}

/**
 * Xóa bản ghi Nói đã nộp (để HV thu âm lại): reset answer_payload + bỏ
 * answer_media qua RPC rồi xóa object storage.
 */
export async function clearSpeakingAnswer(
  kind: AttemptKind,
  attemptId: string,
  itemId: string,
): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("answer_media")
    .select("object_path")
    .eq("attempt_kind", kind)
    .eq("attempt_id", attemptId)
    .eq("set_item_id", itemId)
    .maybeSingle();

  const { error } = await supabase.rpc("clear_answer_media", {
    p_kind: kind,
    p_attempt_id: attemptId,
    p_set_item_id: itemId,
  });
  if (error) return { ok: false, error: error.message };

  if (existing?.object_path) {
    await supabase.storage
      .from(ANSWER_AUDIO_BUCKET)
      .remove([existing.object_path]);
  }
  return { ok: true };
}
