import "server-only";

import { speakingAudioFormat } from "@/features/assessment-results/domain/speaking-audio";
import { createClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * P-C — Lưu bài nói: upload audio HV vào bucket `answer-media` rồi ghi
 * `answer_media` + set answer_payload qua RPC `attach_answer_media` (RPC kiểm
 * chủ lượt/hạn giờ/câu thuộc lượt, fail-closed). Dọn bản ghi cũ nếu thu lại.
 */
export async function persistSpeakingAnswer(
  kind: "exercise" | "exam",
  actorId: string,
  attemptId: string,
  itemId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { ok: false, error: "Thiếu bản ghi âm." };
  }
  const format = speakingAudioFormat(audio.type);
  if (!format) return { ok: false, error: "Định dạng âm thanh không được hỗ trợ." };
  if (audio.size > MAX_AUDIO_BYTES) return { ok: false, error: "Bản ghi tối đa 25 MB." };

  const durationRaw = Number(formData.get("duration_ms"));
  const durationMs =
    Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : undefined;

  const supabase = await createClient();
  // Path bắt đầu bằng uid → storage policy chỉ cho HV ghi vào thư mục của mình.
  const objectPath = `${actorId}/${attemptId}/${itemId}/${crypto.randomUUID()}.${format.extension}`;
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const uploaded = await supabase.storage
    .from("answer-media")
    .upload(objectPath, bytes, { contentType: format.mimeType, upsert: false });
  if (uploaded.error) {
    return { ok: false, error: `Không tải được bản ghi: ${uploaded.error.message}` };
  }

  // Đường dẫn bản ghi cũ (nếu có) để xóa sau khi ghi mới thành công.
  const { data: prior } = await supabase
    .from("answer_media")
    .select("object_path")
    .eq("attempt_kind", kind)
    .eq("attempt_id", attemptId)
    .eq("set_item_id", itemId)
    .maybeSingle();

  const { error: rpcError } = await supabase.rpc("attach_answer_media", {
    p_kind: kind,
    p_attempt_id: attemptId,
    p_set_item_id: itemId,
    p_object_path: objectPath,
    p_mime: format.mimeType,
    p_size: audio.size,
    p_duration_ms: durationMs,
  });
  if (rpcError) {
    await supabase.storage.from("answer-media").remove([objectPath]);
    return { ok: false, error: rpcError.message };
  }

  if (prior?.object_path && prior.object_path !== objectPath) {
    await supabase.storage.from("answer-media").remove([prior.object_path]);
  }
  return { ok: true };
}

/**
 * P-C — Xóa bản ghi Nói đã nộp (để HV thu âm lại): reset answer_payload + bỏ
 * answer_media qua RPC rồi xóa object storage.
 */
export async function clearSpeakingAnswer(
  kind: "exercise" | "exam",
  attemptId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
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
    await supabase.storage.from("answer-media").remove([existing.object_path]);
  }
  return { ok: true };
}
