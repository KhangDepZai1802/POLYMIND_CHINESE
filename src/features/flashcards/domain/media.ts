export const FLASHCARD_MEDIA_BUCKET = "flashcard-media";
export const MAX_FLASHCARD_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FLASHCARD_AUDIO_BYTES = 20 * 1024 * 1024;

/** Số mục tối đa của hai danh sách con §7ter — Zod cưỡng chế, DB không biết. */
export const MAX_FLASHCARD_EXAMPLE_SENTENCES = 8;
export const MAX_FLASHCARD_PHRASE_ITEMS = 8;

/** Ba khe cố định của một trang: hai mặt ảnh + audio phát âm. */
export const FLASHCARD_FIXED_MEDIA_SLOTS = ["front", "back", "audio"] as const;
export type FlashcardFixedMediaSlot =
  (typeof FLASHCARD_FIXED_MEDIA_SLOTS)[number];

/**
 * Ảnh của **câu ví dụ** (§7ter khối 4). Một thẻ có nhiều câu ví dụ nên khe phải
 * mang CHỈ SỐ, khác hẳn ba khe cố định ở trên — đây chính là ràng buộc 2 của
 * `DS-049`: quy ước đường dẫn cũ chỉ có đúng 3 khe nên không chứa nổi ảnh này.
 */
export type FlashcardExampleMediaSlot = `example-${number}`;
export type FlashcardMediaSlot =
  | FlashcardFixedMediaSlot
  | FlashcardExampleMediaSlot;

/** front + back + audio + tối đa một ảnh cho mỗi câu ví dụ. */
export const MAX_FLASHCARD_UPLOAD_FILES =
  FLASHCARD_FIXED_MEDIA_SLOTS.length + MAX_FLASHCARD_EXAMPLE_SENTENCES;

const EXAMPLE_SLOT_PATTERN = /^example-(\d+)$/;

export function exampleMediaSlot(index: number): FlashcardExampleMediaSlot {
  return `example-${index}`;
}

export function isAudioSlot(slot: FlashcardMediaSlot): boolean {
  return slot === "audio";
}

export function isFlashcardMediaSlot(
  value: unknown,
): value is FlashcardMediaSlot {
  if (typeof value !== "string") return false;
  if ((FLASHCARD_FIXED_MEDIA_SLOTS as readonly string[]).includes(value)) {
    return true;
  }
  const match = EXAMPLE_SLOT_PATTERN.exec(value);
  if (!match) return false;
  const index = Number(match[1]);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < MAX_FLASHCARD_EXAMPLE_SENTENCES
  );
}

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

  if (isAudioSlot(slot)) {
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
  return isAudioSlot(slot)
    ? MAX_FLASHCARD_AUDIO_BYTES
    : MAX_FLASHCARD_IMAGE_BYTES;
}

/**
 * Alt của ảnh flashcard do hệ thống sinh — admin không nhập mô tả, nhưng screen
 * reader vẫn phải đọc được thẻ đang xem là gì. Từ Phase 16 thẻ từ vựng không còn
 * cột `term`; tên gọi dựng từ `hanzi` + `meaning_vi`.
 */
export function flashcardAltText(input: {
  kind: "session_cover" | "vocabulary";
  face: "front" | "back";
  hanzi: string | null;
  meaningVi: string | null;
  sectionTitle: string;
}): string {
  const face = input.face === "front" ? "Mặt trước" : "Mặt sau";
  const sectionTitle = input.sectionTitle.trim() || "buổi học";
  const name = [input.hanzi?.trim(), input.meaningVi?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(" — ");
  return input.kind === "vocabulary" && name
    ? `${face} thẻ từ vựng ${name}`
    : `${face} trang mở đầu ${sectionTitle}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OWNED_FILE_PATTERN =
  /^(front|back|audio|example-\d+)-([0-9a-f-]{36})\.(jpg|png|webp|mp3|m4a)$/;

/** `"example-2-<uuid>.png"` → `"example-2"`; tên file lạ → `null`. */
export function flashcardMediaSlotFromFileName(
  fileName: string,
): FlashcardMediaSlot | null {
  const match = OWNED_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  const slot = match[1]!;
  return isFlashcardMediaSlot(slot) ? slot : null;
}

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

  const match = OWNED_FILE_PATTERN.exec(segments[4] ?? "");
  if (!match) return false;
  if (match[1] !== expected.slot) return false;
  if (!UUID_PATTERN.test(match[2] ?? "")) return false;

  // Khe và đuôi file phải cùng loại. Bản trước cho MỌI khe nhận cả 5 đuôi, nên
  // một file `.mp3` vẫn lọt vào khe ảnh và ngược lại.
  const extension = match[3]!.toLowerCase();
  const isAudioExtension = extension === "mp3" || extension === "m4a";
  return isAudioSlot(expected.slot) === isAudioExtension;
}
