import type { z } from "zod";

import {
  flashcardExampleItemSchema,
  flashcardPhraseItemSchema,
  flashcardSenseItemSchema,
  type FlashcardExampleItem,
  type FlashcardPhraseItem,
  type FlashcardSenseItem,
} from "@/features/flashcards/schema";

/**
 * Đọc ba danh sách con từ `jsonb`.
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
  senses: FlashcardSenseItem[];
  examples: FlashcardExampleItem[];
  phrases: FlashcardPhraseItem[];
};

export function readFlashcardSublists(page: {
  sense_breakdown: unknown;
  example_sentences: unknown;
  common_phrases: unknown;
}): FlashcardSublists {
  return {
    senses: readList(flashcardSenseItemSchema, page.sense_breakdown),
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
