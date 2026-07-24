import "server-only";

import { FLASHCARD_MEDIA_BUCKET } from "@/features/flashcards/domain/media";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";
import type { Database } from "@/types/database";

type DeckRow = Database["public"]["Tables"]["flashcard_decks"]["Row"];
type SectionRow = Database["public"]["Tables"]["flashcard_sections"]["Row"];
type PageRow = Database["public"]["Tables"]["flashcard_pages"]["Row"];

export type FlashcardPageView = PageRow & {
  frontUrl: string | null;
  backUrl: string | null;
  audioUrl: string | null;
  /**
   * `path` → signed URL cho **mọi** media của trang, gồm ảnh của từng câu ví dụ
   * nằm trong `jsonb`. Template tra thẳng bằng `image_path` của câu ví dụ.
   */
  mediaUrls: Record<string, string>;
};

export type FlashcardSectionView = SectionRow & {
  pages: FlashcardPageView[];
};

export type FlashcardDeckView = DeckRow & {
  sections: FlashcardSectionView[];
};

export type FlashcardCourseOption = {
  id: string;
  code: string;
  title: string;
  defaultSessionCount: number | null;
  deck: { id: string; status: DeckRow["status"] } | null;
};

/**
 * Ký URL cho các trang rồi gom theo buổi.
 *
 * Dùng CHUNG cho cả admin lẫn học viên: trước Phase 16 hai hàm dưới chép nguyên
 * khối này hai bản, đúng hình dạng đã sinh ra `UX-UIUX-M25-010` (ba bản ô số
 * liệu trôi khác nhau ở chỗ nhìn thấy được).
 *
 * Nguồn đường dẫn là `media_paths` — cột do trigger DB tổng hợp — chứ không
 * phải liệt kê lại ba cột như trước; liệt kê tay chính là chỗ ảnh câu ví dụ bị
 * bỏ sót và học viên nhận 403 (`DS-049` điểm 1).
 */
async function signPagesBySection(
  supabase: SupabaseClient<Database>,
  pages: PageRow[],
  expiresInSeconds: number,
): Promise<Map<string, FlashcardPageView[]>> {
  const allPaths = [...new Set(pages.flatMap((page) => page.media_paths))];
  const signed = await signPaths(
    supabase,
    FLASHCARD_MEDIA_BUCKET,
    allPaths,
    expiresInSeconds,
  );

  const pagesBySection = new Map<string, FlashcardPageView[]>();
  for (const page of pages) {
    const mediaUrls: Record<string, string> = {};
    for (const path of page.media_paths) {
      const url = signed.get(path);
      if (url) mediaUrls[path] = url;
    }

    const group = pagesBySection.get(page.section_id) ?? [];
    group.push({
      ...page,
      frontUrl: page.front_image_path
        ? (mediaUrls[page.front_image_path] ?? null)
        : null,
      backUrl: page.back_image_path
        ? (mediaUrls[page.back_image_path] ?? null)
        : null,
      audioUrl: page.audio_path ? (mediaUrls[page.audio_path] ?? null) : null,
      mediaUrls,
    });
    pagesBySection.set(page.section_id, group);
  }
  return pagesBySection;
}

export async function getFlashcardCourseOptions(): Promise<
  FlashcardCourseOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,code,title,default_session_count,status,flashcard_decks(id,status)",
    )
    .neq("status", "archived")
    .order("title");

  if (error) throw new Error("Không tải được danh sách khóa học.");
  return data.map((course) => ({
    id: course.id,
    code: course.code,
    title: course.title,
    defaultSessionCount: course.default_session_count,
    deck: course.flashcard_decks ?? null,
  }));
}

export async function getAdminFlashcardDeck(
  courseId: string,
): Promise<FlashcardDeckView | null> {
  const supabase = await createClient();
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  if (deckError) throw new Error("Không tải được bộ flashcard.");
  if (!deck) return null;

  const { data: sections, error: sectionError } = await supabase
    .from("flashcard_sections")
    .select("*")
    .eq("deck_id", deck.id)
    .is("archived_at", null)
    .order("session_number");
  if (sectionError) throw new Error("Không tải được mục lục flashcard.");

  const sectionIds = sections.map((section) => section.id);
  const pageResult =
    sectionIds.length === 0
      ? { data: [] as PageRow[], error: null }
      : await supabase
          .from("flashcard_pages")
          .select("*")
          .in("section_id", sectionIds)
          .is("archived_at", null)
          .order("order_index");
  if (pageResult.error) throw new Error("Không tải được trang flashcard.");

  const pagesBySection = await signPagesBySection(
    supabase,
    pageResult.data ?? [],
    300,
  );

  return {
    ...deck,
    sections: sections.map((section) => ({
      ...section,
      pages: pagesBySection.get(section.id) ?? [],
    })),
  };
}

/**
 * ★ thẻ khó của CHÍNH học viên đang đăng nhập.
 *
 * Không truyền `student_id` vào câu truy vấn: RLS đã lọc theo
 * `app.my_student_id()`, nên thêm điều kiện ở app chỉ tạo ra một nguồn sự thật
 * thứ hai về "của ai" — đúng thứ `BUG_M10_01` cảnh báo.
 */
export async function getStudentStarredPageIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcard_starred_pages")
    .select("page_id");
  if (error) throw new Error("Không tải được danh sách thẻ khó của bạn.");
  return data.map((row) => row.page_id);
}

export async function getStudentFlashcardDeck(
  courseId: string,
): Promise<FlashcardDeckView | null> {
  const supabase = await createClient();
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .select("*")
    .eq("course_id", courseId)
    .eq("status", "published")
    .maybeSingle();

  if (deckError) throw new Error("Không tải được bộ flashcard của bạn.");
  if (!deck) return null;

  const { data: sections, error: sectionError } = await supabase
    .from("flashcard_sections")
    .select("*")
    .eq("deck_id", deck.id)
    .eq("status", "published")
    .is("archived_at", null)
    .order("session_number");
  if (sectionError) {
    throw new Error("Không tải được mục lục flashcard của bạn.");
  }

  const sectionIds = sections.map((section) => section.id);
  const pageResult =
    sectionIds.length === 0
      ? { data: [] as PageRow[], error: null }
      : await supabase
          .from("flashcard_pages")
          .select("*")
          .in("section_id", sectionIds)
          .is("archived_at", null)
          .order("order_index");
  if (pageResult.error) {
    throw new Error("Không tải được trang flashcard của bạn.");
  }

  const pagesBySection = await signPagesBySection(
    supabase,
    pageResult.data ?? [],
    900,
  );

  return {
    ...deck,
    sections: sections.map((section) => ({
      ...section,
      pages: pagesBySection.get(section.id) ?? [],
    })),
  };
}
