export const ANSWER_AUDIO_BUCKET = "answer-media";
export const MAX_SPEAKING_AUDIO_BYTES = 25 * 1024 * 1024;

export type SpeakingUploadTicket = {
  path: string;
  token: string;
  contentType: string;
};

type SpeakingAudioFormat = {
  mimeType: string;
  extension: string;
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
};

export function speakingAudioFormat(
  mimeType: string,
): SpeakingAudioFormat | null {
  const normalizedMime = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  const extension = AUDIO_EXTENSIONS[normalizedMime];
  return extension ? { mimeType: normalizedMime, extension } : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Vé upload câu Nói luôn nằm đúng namespace do server sinh:
 * `{student_uid}/{attempt_id}/{item_id}/{file_uuid}.{ext}`.
 */
export function isOwnedSpeakingAudioPath(
  objectPath: string,
  actorId: string,
  attemptId: string,
  itemId: string,
): boolean {
  const segments = objectPath.split("/");
  if (
    segments.length !== 4 ||
    segments[0] !== actorId ||
    segments[1] !== attemptId ||
    segments[2] !== itemId ||
    !UUID_PATTERN.test(actorId) ||
    !UUID_PATTERN.test(attemptId) ||
    !UUID_PATTERN.test(itemId)
  ) {
    return false;
  }

  const file = /^([0-9a-f-]{36})\.([a-z0-9]+)$/i.exec(segments[3] ?? "");
  if (!file || !UUID_PATTERN.test(file[1]!)) return false;
  return Object.values(AUDIO_EXTENSIONS).includes(file[2]!.toLowerCase());
}

export function speakingAudioPathExtension(objectPath: string): string | null {
  const extension = objectPath.split(".").at(-1)?.toLowerCase();
  return extension && Object.values(AUDIO_EXTENSIONS).includes(extension)
    ? extension
    : null;
}
