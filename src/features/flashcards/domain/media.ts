export const FLASHCARD_MEDIA_BUCKET = "flashcard-media";
export const MAX_FLASHCARD_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FLASHCARD_AUDIO_BYTES = 20 * 1024 * 1024;

export const FLASHCARD_MEDIA_SLOTS = ["front", "back", "audio"] as const;
export type FlashcardMediaSlot = (typeof FLASHCARD_MEDIA_SLOTS)[number];

type FlashcardMediaFormat = {
  extension: "jpg" | "png" | "webp" | "mp3" | "m4a";
  mimeType:
    "image/jpeg" | "image/png" | "image/webp" | "audio/mpeg" | "audio/mp4";
};

const IMAGE_MIME_ALIASES = {
  jpg: new Set(["", "image/jpeg", "image/jpg"]),
  jpeg: new Set(["", "image/jpeg", "image/jpg"]),
  png: new Set(["", "image/png"]),
  webp: new Set(["", "image/webp"]),
} as const;

const AUDIO_MIME_ALIASES = {
  mp3: new Set(["", "audio/mpeg", "audio/mp3"]),
  m4a: new Set(["", "audio/mp4", "audio/m4a", "audio/x-m4a"]),
} as const;

function normalizedMime(rawMimeType: string | null | undefined) {
  return (rawMimeType ?? "").split(";", 1)[0]!.trim().toLowerCase();
}

export function flashcardMediaFormat(
  slot: FlashcardMediaSlot,
  fileName: string,
  rawMimeType: string | null | undefined,
): FlashcardMediaFormat | null {
  const rawExtension = fileName.split(".").at(-1)?.toLowerCase();
  const mimeType = normalizedMime(rawMimeType);

  if (slot === "audio") {
    if (rawExtension !== "mp3" && rawExtension !== "m4a") return null;
    if (!AUDIO_MIME_ALIASES[rawExtension].has(mimeType)) return null;
    return rawExtension === "mp3"
      ? { extension: "mp3", mimeType: "audio/mpeg" }
      : { extension: "m4a", mimeType: "audio/mp4" };
  }

  if (
    rawExtension !== "jpg" &&
    rawExtension !== "jpeg" &&
    rawExtension !== "png" &&
    rawExtension !== "webp"
  ) {
    return null;
  }
  if (!IMAGE_MIME_ALIASES[rawExtension].has(mimeType)) return null;

  if (rawExtension === "jpg" || rawExtension === "jpeg") {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  return rawExtension === "png"
    ? { extension: "png", mimeType: "image/png" }
    : { extension: "webp", mimeType: "image/webp" };
}

export function flashcardMediaSizeLimit(slot: FlashcardMediaSlot) {
  return slot === "audio"
    ? MAX_FLASHCARD_AUDIO_BYTES
    : MAX_FLASHCARD_IMAGE_BYTES;
}

/**
 * Alt của ảnh flashcard do hệ thống sinh — admin không nhập mô tả nữa, nhưng
 * screen reader vẫn phải đọc được thẻ đang xem là gì.
 */
export function flashcardAltText(input: {
  kind: "session_cover" | "vocabulary";
  face: "front" | "back";
  term: string | null;
  sectionTitle: string;
}): string {
  const face = input.face === "front" ? "Mặt trước" : "Mặt sau";
  const term = input.term?.trim();
  const sectionTitle = input.sectionTitle.trim() || "buổi học";
  return input.kind === "vocabulary" && term
    ? `${face} thẻ từ vựng ${term}`
    : `${face} trang mở đầu ${sectionTitle}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOwnedFlashcardMediaPath(
  objectPath: string,
  expected: {
    actorId: string;
    deckId: string;
    sectionId: string;
    pageId: string;
    slot: FlashcardMediaSlot;
  },
): boolean {
  const segments = objectPath.split("/");
  if (
    segments.length !== 5 ||
    segments[0] !== expected.actorId ||
    segments[1] !== expected.deckId ||
    segments[2] !== expected.sectionId ||
    segments[3] !== expected.pageId
  ) {
    return false;
  }

  const file = segments[4] ?? "";
  const match =
    /^(front|back|audio)-([0-9a-f-]{36})\.(jpg|png|webp|mp3|m4a)$/i.exec(file);
  return Boolean(
    match && match[1] === expected.slot && UUID_PATTERN.test(match[2] ?? ""),
  );
}
