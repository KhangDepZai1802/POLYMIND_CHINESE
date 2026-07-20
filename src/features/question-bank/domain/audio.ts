export const QUESTION_AUDIO_BUCKET = "question-media";
export const MAX_QUESTION_AUDIO_BYTES = 50 * 1024 * 1024;

type QuestionAudioFormat = {
  extension: "mp3" | "m4a";
  mimeType: "audio/mpeg" | "audio/mp4";
};

const MIME_ALIASES: Record<QuestionAudioFormat["extension"], Set<string>> = {
  mp3: new Set(["", "audio/mpeg", "audio/mp3"]),
  m4a: new Set(["", "audio/mp4", "audio/m4a", "audio/x-m4a"]),
};

/**
 * Chuẩn hóa định dạng audio từ cả tên file và MIME trình duyệt.
 * MIME có thể trống hoặc dùng alias trên Windows/Safari, nhưng phần mở rộng
 * vẫn phải thuộc allowlist để không biến content-type khai báo thành bypass.
 */
export function questionAudioFormat(
  fileName: string,
  rawMimeType: string | null | undefined,
): QuestionAudioFormat | null {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (extension !== "mp3" && extension !== "m4a") return null;

  const mimeType = (rawMimeType ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (!MIME_ALIASES[extension].has(mimeType)) return null;

  return {
    extension,
    mimeType: extension === "mp3" ? "audio/mpeg" : "audio/mp4",
  };
}

/** Vé upload luôn có đúng dạng `{actor_uid}/{uuid}.{mp3|m4a}` do server sinh. */
export function isOwnedQuestionAudioPath(
  objectPath: string,
  actorId: string,
): boolean {
  const segments = objectPath.split("/");
  if (segments.length !== 2 || segments[0] !== actorId) return false;

  const match = /^([0-9a-f-]{36})\.(mp3|m4a)$/i.exec(segments[1] ?? "");
  if (!match) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    match[1]!,
  );
}
