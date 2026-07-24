import { z } from "zod";

import {
  isFlashcardMediaSlot,
  MAX_FLASHCARD_EXAMPLE_SENTENCES,
  MAX_FLASHCARD_PHRASE_ITEMS,
  MAX_FLASHCARD_SENSE_ITEMS,
  MAX_FLASHCARD_UPLOAD_FILES,
  type FlashcardMediaSlot,
} from "@/features/flashcards/domain/media";

export const flashcardDeckSchema = z.object({
  course_id: z.uuid("Khóa học không hợp lệ."),
  title: z.string().trim().min(2, "Nhập tên bộ flashcard.").max(120),
  description: z.string().trim().max(500).optional().default(""),
});

export const flashcardSectionSchema = z.object({
  id: z.uuid().optional(),
  deck_id: z.uuid("Bộ flashcard không hợp lệ."),
  session_number: z.coerce.number().int().positive("Số buổi phải lớn hơn 0."),
  title: z.string().trim().min(2, "Nhập tên buổi.").max(120),
});

// =====================================================================
// Ba danh sách con của thẻ từ vựng (§7ter khối 3, 4, 5)
// =====================================================================
// ⚠️ Ba danh sách này lưu ở cột `jsonb`, mà `jsonb` KHÔNG có FK và KHÔNG có
// CHECK hình dạng ở tầng DB. Các schema dưới đây là chỗ cưỡng chế DUY NHẤT
// (`DS-050` điểm 1) — mọi đường ghi phải đi qua chúng (`BUG_M10_01`).

export const flashcardSenseItemSchema = z.object({
  hanzi: z.string().trim().min(1, "Nhập thành tố Hán tự.").max(40),
  pinyin: z.string().trim().min(1, "Nhập pinyin của thành tố.").max(80),
  meaning_vi: z.string().trim().min(1, "Nhập nghĩa của thành tố.").max(200),
});

export const flashcardExampleItemSchema = z.object({
  hanzi: z.string().trim().min(1, "Nhập câu ví dụ bằng Hán tự.").max(200),
  pinyin: z.string().trim().min(1, "Nhập pinyin của câu ví dụ.").max(300),
  meaning_vi: z
    .string()
    .trim()
    .min(1, "Nhập nghĩa tiếng Việt của câu ví dụ.")
    .max(300),
  image_path: z
    .string()
    .trim()
    .max(400)
    .nullish()
    .transform((value) => value || null),
});

export const flashcardPhraseItemSchema = z.object({
  hanzi: z.string().trim().min(1, "Nhập cụm từ bằng Hán tự.").max(80),
  pinyin: z.string().trim().min(1, "Nhập pinyin của cụm từ.").max(120),
  meaning_vi: z.string().trim().min(1, "Nhập nghĩa của cụm từ.").max(200),
});

export type FlashcardSenseItem = z.infer<typeof flashcardSenseItemSchema>;
export type FlashcardExampleItem = z.infer<typeof flashcardExampleItemSchema>;
export type FlashcardPhraseItem = z.infer<typeof flashcardPhraseItemSchema>;

/**
 * Ba danh sách con đi qua `FormData` dưới dạng chuỗi JSON. Preprocess đọc cả ba
 * hình dạng gặp thật: mảng sẵn (gọi từ server), chuỗi JSON (form), rỗng.
 * JSON hỏng thì trả `null` để `z.array` báo đúng câu tiếng Việt bên dưới —
 * không bao giờ đẩy nguyên văn lỗi parse ra giao diện (`EX-21`).
 */
function jsonList<T extends z.ZodTypeAny>(
  item: T,
  max: number,
  label: string,
) {
  return z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null || raw === "") return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    z
      .array(item, { error: `Danh sách "${label}" không đọc được.` })
      .max(max, `Danh sách "${label}" tối đa ${max} mục.`),
  );
}

// =====================================================================
// Trang flashcard — HAI mô hình dữ liệu tách theo `kind`
// =====================================================================

const pageIdentity = {
  id: z.uuid("Trang flashcard không hợp lệ."),
  section_id: z.uuid("Buổi flashcard không hợp lệ."),
};

const optionalMediaPath = z
  .string()
  .trim()
  .max(400)
  .nullish()
  .transform((value) => value || null);

/** Trang mở đầu: đúng hai ảnh, không chữ, không audio (chốt `Q5`). */
export const flashcardSessionCoverPageSchema = z.object({
  ...pageIdentity,
  kind: z.literal("session_cover"),
  front_image_path: z.string().trim().min(1, "Trang mở đầu cần ảnh mặt trước."),
  back_image_path: z.string().trim().min(1, "Trang mở đầu cần ảnh mặt sau."),
});

/** Thẻ từ vựng: bản ghi có cấu trúc theo §7ter. Ảnh là TUỲ CHỌN. */
export const flashcardVocabularyPageSchema = z.object({
  ...pageIdentity,
  kind: z.literal("vocabulary"),
  hanzi: z.string().trim().min(1, "Nhập Hán tự của thẻ.").max(60),
  pinyin_syllables: z
    .string()
    .trim()
    .min(1, "Nhập pinyin, tách theo âm tiết (ví dụ: hú luó bo).")
    .max(160),
  meaning_vi: z.string().trim().min(1, "Nhập nghĩa tiếng Việt.").max(300),
  // Audio là TUỲ CHỌN ở mức hàng, bắt buộc ở mức CÔNG BỐ (migration 72). Thẻ vừa
  // nhập hàng loạt chưa có audio; ép ở đây thì admin không mở ra sửa nghĩa được.
  audio_path: optionalMediaPath,
  front_image_path: optionalMediaPath,
  back_image_path: optionalMediaPath,
  sense_breakdown: jsonList(
    flashcardSenseItemSchema,
    MAX_FLASHCARD_SENSE_ITEMS,
    "Tách nghĩa",
  ),
  example_sentences: jsonList(
    flashcardExampleItemSchema,
    MAX_FLASHCARD_EXAMPLE_SENTENCES,
    "Câu ví dụ",
  ),
  common_phrases: jsonList(
    flashcardPhraseItemSchema,
    MAX_FLASHCARD_PHRASE_ITEMS,
    "Cụm từ thường dùng",
  ),
});

export const flashcardPageSchema = z
  .discriminatedUnion("kind", [
    flashcardSessionCoverPageSchema,
    flashcardVocabularyPageSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind !== "vocabulary") return;
    // DB cũng chặn bằng `flashcard_pages_distinct_media_check`, nhưng người soạn
    // phải nghe câu tiếng Việt chứ không phải thông báo constraint (`EX-21`).
    if (
      value.front_image_path &&
      value.back_image_path &&
      value.front_image_path === value.back_image_path
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["back_image_path"],
        message:
          "Hai mặt thẻ phải dùng hai ảnh khác nhau. Chọn ảnh riêng cho mặt sau, hoặc bỏ trống.",
      });
    }
  });

export type FlashcardPageInput = z.infer<typeof flashcardPageSchema>;

/**
 * Một dòng của ô "Nhập hàng loạt" (`P16-T4`).
 *
 * ⛔ Cố ý KHÔNG có `audio_path` và không có ảnh: đường nhập hàng loạt chỉ mang
 * chữ, audio gắn sau bằng màn soạn thẻ. Vì vậy thẻ vừa nhập là thẻ **chưa đủ để
 * công bố** — `validate_flashcard_section_publish` chặn ở bước công bố.
 */
export const flashcardImportRowSchema = z.object({
  hanzi: z.string().trim().min(1, "Thiếu Hán tự.").max(60),
  pinyin_syllables: z
    .string()
    .trim()
    .min(1, "Thiếu pinyin.")
    .max(160),
  meaning_vi: z.string().trim().min(1, "Thiếu nghĩa tiếng Việt.").max(300),
});

export type FlashcardImportRow = z.infer<typeof flashcardImportRowSchema>;

export const flashcardUploadRequestSchema = z.object({
  sectionId: z.uuid(),
  pageId: z.uuid().optional(),
  files: z
    .array(
      z.object({
        slot: z.custom<FlashcardMediaSlot>(isFlashcardMediaSlot, {
          message: "Khe media không hợp lệ.",
        }),
        fileName: z.string().min(1),
        mimeType: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(MAX_FLASHCARD_UPLOAD_FILES),
});
