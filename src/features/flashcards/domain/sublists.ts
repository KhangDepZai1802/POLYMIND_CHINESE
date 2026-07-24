import type { z } from "zod";

import {
  flashcardExampleItemSchema,
  flashcardPhraseItemSchema,
  type FlashcardExampleItem,
  type FlashcardPhraseItem,
} from "@/features/flashcards/schema";

/**
 * Đọc hai danh sách con từ `jsonb`.
 *
 * Đường GHI đã đi qua Zod (`DS-050` điểm 1) nên mục sai hình dạng chỉ có thể đến
 * từ thao tác ghi thẳng vào DB. Ở đường ĐỌC ta bỏ qua đúng mục hỏng thay vì ném
 * lỗi cả trang: một mục lỗi không nên làm cả thẻ biến mất khỏi màn học viên.
 * Mục bị bỏ vẫn nhìn thấy được vì màn soạn của admin sẽ hiện thiếu mục đó.
 */
function readList<TSchema extends z.ZodType>(
  schema: TSchema,
  raw: unknown,
): z.infer<TSchema>[] {
  if (!Array.isArray(raw)) return [];
  const items: z.infer<TSchema>[] = [];
  for (const candidate of raw) {
    const parsed = schema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

export type FlashcardSublists = {
  examples: FlashcardExampleItem[];
  phrases: FlashcardPhraseItem[];
};

/**
 * ⛔ Khối "Tách nghĩa" (`sense_breakdown`) đã bị BỎ khỏi sản phẩm (user chốt
 * 2026-07-24) và cột DB cũng đã xoá hẳn ở migration `…074` — user đếm trên cloud
 * ra `tong_the_tu_vung = 206 · co_tach_nghia = 0` nên không mất dữ liệu nào.
 */
export function readFlashcardSublists(page: {
  example_sentences: unknown;
  common_phrases: unknown;
}): FlashcardSublists {
  return {
    examples: readList(flashcardExampleItemSchema, page.example_sentences),
    phrases: readList(flashcardPhraseItemSchema, page.common_phrases),
  };
}

/** Đường dẫn ảnh của các câu ví dụ, theo đúng thứ tự câu. */
export function exampleImagePaths(examples: FlashcardExampleItem[]): string[] {
  return examples
    .map((example) => example.image_path)
    .filter((path): path is string => Boolean(path));
}
