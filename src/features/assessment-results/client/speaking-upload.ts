"use client";

import {
  ANSWER_AUDIO_BUCKET,
  MAX_SPEAKING_AUDIO_BYTES,
  speakingAudioFormat,
  type SpeakingUploadTicket,
} from "@/features/assessment-results/domain/speaking-audio";
import { createClient } from "@/lib/supabase/client";

type UploadResult = { ok: boolean; error?: string };

/**
 * Blob đi thẳng browser → Supabase Storage bằng vé ký ngắn hạn. Server Action
 * chỉ nhận metadata/path nhỏ, tránh giới hạn request mặc định của Next/Vercel.
 */
export async function uploadSpeakingAnswerBlob({
  blob,
  durationMs,
  createTicket,
  attach,
}: {
  blob: Blob;
  durationMs: number;
  createTicket: (input: {
    mimeType: string;
    sizeBytes: number;
  }) => Promise<SpeakingUploadTicket | { error: string }>;
  attach: (input: {
    objectPath: string;
    durationMs: number;
  }) => Promise<UploadResult>;
}): Promise<UploadResult> {
  const format = speakingAudioFormat(blob.type);
  if (!format) {
    return { ok: false, error: "Định dạng âm thanh không được hỗ trợ." };
  }
  if (blob.size <= 0) return { ok: false, error: "Bản ghi âm đang rỗng." };
  if (blob.size > MAX_SPEAKING_AUDIO_BYTES) {
    return { ok: false, error: "Bản ghi tối đa 25 MB." };
  }

  try {
    const ticket = await createTicket({
      mimeType: blob.type,
      sizeBytes: blob.size,
    });
    if ("error" in ticket) return { ok: false, error: ticket.error };

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(ANSWER_AUDIO_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, blob, {
        contentType: ticket.contentType,
      });
    if (error) {
      return {
        ok: false,
        error: "Không tải được bản ghi. Kiểm tra kết nối rồi thử lại.",
      };
    }

    return await attach({
      objectPath: ticket.path,
      durationMs,
    });
  } catch {
    return {
      ok: false,
      error: "Không tải được bản ghi. Kiểm tra kết nối rồi thử lại.",
    };
  }
}
