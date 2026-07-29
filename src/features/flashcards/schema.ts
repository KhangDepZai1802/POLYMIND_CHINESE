import { z } from "zod";

import {
  BULK_MEDIA_SLOTS,
  MAX_FLASHCARD_BULK_UPLOAD_FILES,
} from "@/features/flashcards/domain/bulk-media";
import { MAX_FLASHCARD_COVER_UPLOAD_FILES } from "@/features/flashcards/domain/deck-covers";
import {
  isFlashcardMediaSlot,
  MAX_FLASHCARD_EXAMPLE_SENTENCES,
  MAX_FLASHCARD_PHRASE_ITEMS,
  MAX_FLASHCARD_UPLOAD_FILES,
  type FlashcardMediaSlot,
} from "@/features/flashcards/domain/media";
import {
  flashcardDeckCodeSlug,
  FLASHCARD_DECK_CODE_MAX_LENGTH,
  FLASHCARD_DECK_CODE_MIN_LENGTH,
} from "@/features/flashcards/domain/public-link";

/**
 * Mã bộ — tiền tố của địa chỉ QR (`MULTIDECK-1`).
 *
 * Chuẩn hoá TRƯỚC rồi mới kiểm, để người dùng gõ `VCB Ngữ Pháp` vẫn ra
 * `vcb-ngu-phap` thay vì bị chặn với một thông báo khó hiểu. Chuẩn hoá ở đây,
 * cưỡng chế hình dạng ở DB (`flashcard_decks_code_shape_check`) — một nơi
 * biến đổi, một nơi làm chốt chặn cuối, không phải hai nguồn sự thật.
 */
const deckCodeSchema = z
  .string()
  .trim()
  .min(1, "Nhập mã bộ.")
  .transform(flashcardDeckCodeSlug)
  .refine((value) => value.length >= FLASHCARD_DECK_CODE_MIN_LENGTH, {
    message: "Mã bộ cần ít nhất 2 chữ hoặc số.",
  })
  .refine((value) => value.length <= FLASHCARD_DECK_CODE_MAX_LENGTH, {
    message: `Mã bộ tối đa ${FLASHCARD_DECK_CODE_MAX_LENGTH} ký tự.`,
  });

export const flashcardDeckSchema = z.object({
  // Có `id` = sửa bộ đang có, không có = tạo mới. Một schema cho cả hai đường
  // vì chúng ghi vào cùng một bảng với cùng ràng buộc (`BUG_M10_01`).
  id: z.uuid().optional(),
  course_id: z.uuid("Khóa học không hợp lệ."),
  code: deckCodeSchema,
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
// Hai danh sách con của thẻ từ vựng (§7ter khối "Câu ví dụ" và "Cụm từ")
// =====================================================================
// ⚠️ Hai danh sách này lưu ở cột `jsonb`, mà `jsonb` KHÔNG có FK và KHÔNG có
// CHECK hình dạng ở tầng DB. Các schema dưới đây là chỗ cưỡng chế DUY NHẤT
// (`DS-050` điểm 1) — mọi đường ghi phải đi qua chúng (`BUG_M10_01`).
//
// ⛔ Khối thứ ba "Tách nghĩa" (`sense_breakdown`) đã bị BỎ khỏi sản phẩm (user
// chốt 2026-07-24): mặt sau chỉ còn Thẻ · Nghĩa · Câu ví dụ · Cụm từ. Cột DB
// cũng đã xoá hẳn ở migration `…074`.

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

export type FlashcardExampleItem = z.infer<typeof flashcardExampleItemSchema>;
export type FlashcardPhraseItem = z.infer<typeof flashcardPhraseItemSchema>;

/**
 * Hai danh sách con đi qua `FormData` dưới dạng chuỗi JSON. Preprocess đọc cả ba
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

/**
 * Trang mở đầu: ĐÚNG MỘT ảnh, không chữ, không audio (`D-41`, đảo `Q5`).
 *
 * ⛔ KHÔNG có `back_image_path`: từ 2026-07-29 trang mở đầu vẫn lật hai mặt
 * nhưng cả hai mặt vẽ lại **cùng một file** (`flashcard-face.tsx`). DB chặn bằng
 * `flashcard_pages_image_kind_check` (migration `…084`); bỏ hẳn khỏi Zod để một
 * payload cũ mang `back_image_path` không lặng lẽ được ghi — đúng lối `…078` đã
 * làm với thẻ từ vựng.
 */
export const flashcardSessionCoverPageSchema = z.object({
  ...pageIdentity,
  kind: z.literal("session_cover"),
  front_image_path: z.string().trim().min(1, "Trang mở đầu cần một ảnh."),
});

/**
 * Thẻ từ vựng: bản ghi có cấu trúc theo §7ter. Ảnh mặt trước là TUỲ CHỌN.
 *
 * ⛔ KHÔNG có `back_image_path`: từ 2026-07-25 mặt sau thẻ từ vựng dựng bằng CHỮ
 * (4 khối §7ter), ảnh mặt sau là thứ thừa. DB chặn bằng
 * `flashcard_pages_image_kind_check` (migration `…078`); bỏ hẳn khỏi Zod để một
 * payload cũ mang `back_image_path` không lặng lẽ được ghi.
 */
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

export const flashcardPageSchema = z.discriminatedUnion("kind", [
  flashcardSessionCoverPageSchema,
  flashcardVocabularyPageSchema,
]);

export type FlashcardPageInput = z.infer<typeof flashcardPageSchema>;

/**
 * Một dòng của ô "Nhập hàng loạt" (`P16-T4`, mở rộng `D-35` điểm 1).
 *
 * ⛔ Cố ý KHÔNG có `audio_path` và không có ảnh: đường nhập hàng loạt chỉ mang
 * chữ, audio và ảnh gắn sau bằng màn soạn thẻ. Vì vậy thẻ vừa nhập là thẻ **chưa
 * đủ để công bố** — `validate_flashcard_section_publish` chặn ở bước công bố.
 *
 * Hai danh sách con dùng LẠI đúng schema của màn soạn thẻ, không viết bản thứ
 * hai: một hình dạng dữ liệu chỉ được có một chỗ cưỡng chế (`BUG_M10_01`).
 * `.default([])` giữ đường 3 cột cũ chạy y hệt — dòng không có cột 4/5 vẫn hợp lệ.
 */
export const flashcardImportRowSchema = z.object({
  hanzi: z.string().trim().min(1, "Thiếu Hán tự.").max(60),
  pinyin_syllables: z
    .string()
    .trim()
    .min(1, "Thiếu pinyin.")
    .max(160),
  meaning_vi: z.string().trim().min(1, "Thiếu nghĩa tiếng Việt.").max(300),
  example_sentences: z
    .array(flashcardExampleItemSchema)
    .max(
      MAX_FLASHCARD_EXAMPLE_SENTENCES,
      `Tối đa ${MAX_FLASHCARD_EXAMPLE_SENTENCES} câu ví dụ.`,
    )
    .default([]),
  common_phrases: z
    .array(flashcardPhraseItemSchema)
    .max(
      MAX_FLASHCARD_PHRASE_ITEMS,
      `Tối đa ${MAX_FLASHCARD_PHRASE_ITEMS} cụm từ.`,
    )
    .default([]),
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

/**
 * Xin vé tải media cho **NHIỀU trang trong một lượt** (`P16-T11`).
 *
 * 🔴 Vì sao phải có schema riêng thay vì gọi lặp `flashcardUploadRequestSchema`:
 * `consumeRateLimit(supabase, "material_upload")` tiêu **một đơn vị mỗi LƯỢT
 * GỌI** action, mà trần là **20 lượt/giờ** (`…034_rate_limits.sql`). Gọi lặp cho
 * từng thẻ thì buổi từ 21 thẻ trở lên không bao giờ chạy xong, và admin bị khoá
 * upload cả tiếng — kể cả đường soạn thẻ lẻ. Cả buổi phải là ĐÚNG MỘT lượt gọi.
 *
 * Khe giới hạn ở `front` và `audio`: ảnh mặt sau không đi đường hàng loạt.
 */
export const flashcardBulkUploadRequestSchema = z.object({
  sectionId: z.uuid(),
  items: z
    .array(
      z.object({
        pageId: z.uuid(),
        slot: z.enum(BULK_MEDIA_SLOTS),
        fileName: z.string().min(1),
        mimeType: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1, "Chưa có file nào để tải.")
    .max(
      MAX_FLASHCARD_BULK_UPLOAD_FILES,
      `Mỗi lượt tối đa ${MAX_FLASHCARD_BULK_UPLOAD_FILES} file.`,
    ),
});

/**
 * Xin vé tải ảnh trang mở đầu cho **cả bộ trong MỘT lượt gọi** (`COVER-1`).
 *
 * 🔴 Cùng ràng buộc cứng đã ép `flashcardBulkUploadRequestSchema` phải tồn tại:
 * `consumeRateLimit(supabase, "material_upload")` tiêu một đơn vị mỗi LƯỢT GỌI
 * action, trần 20 lượt/giờ. Gọi lặp cho từng buổi thì bộ 35 buổi không bao giờ
 * chạy xong và admin bị khoá upload cả tiếng — kể cả đường soạn thẻ lẻ.
 *
 * Không có trường `slot`: trang mở đầu chỉ còn đúng một khe ảnh (`front`).
 */
export const flashcardDeckCoverUploadRequestSchema = z.object({
  deckId: z.uuid(),
  items: z
    .array(
      z.object({
        sectionId: z.uuid(),
        fileName: z.string().min(1),
        mimeType: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1, "Chưa có ảnh nào để tải.")
    .max(
      MAX_FLASHCARD_COVER_UPLOAD_FILES,
      `Mỗi lượt tối đa ${MAX_FLASHCARD_COVER_UPLOAD_FILES} ảnh.`,
    ),
});

/** Bảng kê "buổi nào nhận ảnh nào" gửi xuống RPC `attach_flashcard_deck_covers`. */
export const flashcardDeckCoverAssignmentSchema = z.object({
  deckId: z.uuid(),
  allowOverwrite: z.boolean().default(false),
  assignments: z
    .array(
      z.object({
        sectionId: z.uuid(),
        // Mã trang do client giữ: nó đã được dùng để dựng đường dẫn object lúc
        // xin vé, nên sinh mã mới ở bước này là tự làm đường dẫn mồ côi.
        pageId: z.uuid(),
        frontImagePath: z.string().trim().min(1).max(400),
      }),
    )
    .min(1)
    .max(MAX_FLASHCARD_COVER_UPLOAD_FILES),
});

/** Bảng kê "thẻ nào nhận đường dẫn nào" gửi xuống RPC `…077`. */
export const flashcardMediaAssignmentSchema = z.object({
  sectionId: z.uuid(),
  allowOverwrite: z.boolean().default(false),
  assignments: z
    .array(
      z.object({
        pageId: z.uuid(),
        frontImagePath: z.string().trim().max(400).nullish(),
        audioPath: z.string().trim().max(400).nullish(),
      }),
    )
    .min(1)
    .max(MAX_FLASHCARD_BULK_UPLOAD_FILES),
});
