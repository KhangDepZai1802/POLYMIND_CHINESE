import "server-only";

import { FLASHCARD_MEDIA_BUCKET } from "@/features/flashcards/domain/media";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";
import type { Database } from "@/types/database";

type DeckRow = Database["public"]["Tables"]["flashcard_decks"]["Row"];
type SectionRow = Database["public"]["Tables"]["flashcard_sections"]["Row"];
type PageRow = Database["public"]["Tables"]["flashcard_pages"]["Row"];

export type FlashcardCourseOption = {
  id: string;
  code: string;
  title: string;
  defaultSessionCount: number | null;
  deck: { id: string; status: DeckRow["status"] } | null;
};

export type FlashcardPageView = PageRow & {
  frontUrl: string | null;
  backUrl: string | null;
  audioUrl: string | null;
};

export type FlashcardSectionView = SectionRow & {
  pages: FlashcardPageView[];
};

export type FlashcardDeckView = DeckRow & {
  sections: FlashcardSectionView[];
};

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
  const pages = pageResult.data ?? [];

  const signed = await signPaths(
    supabase,
    FLASHCARD_MEDIA_BUCKET,
    pages.flatMap((page) =>
      [page.front_image_path, page.back_image_path, page.audio_path].filter(
        (path): path is string => Boolean(path),
      ),
    ),
    300,
  );

  const pagesBySection = new Map<string, FlashcardPageView[]>();
  for (const page of pages) {
    const group = pagesBySection.get(page.section_id) ?? [];
    group.push({
      ...page,
      frontUrl: signed.get(page.front_image_path) ?? null,
      backUrl: signed.get(page.back_image_path) ?? null,
      audioUrl: page.audio_path
        ? (signed.get(page.audio_path) ?? null)
        : null,
    });
    pagesBySection.set(page.section_id, group);
  }

  return {
    ...deck,
    sections: sections.map((section) => ({
      ...section,
      pages: pagesBySection.get(section.id) ?? [],
    })),
  };
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
    .order("session_number");
  if (sectionError)
    throw new Error("Không tải được mục lục flashcard của bạn.");

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
  if (pageResult.error)
    throw new Error("Không tải được trang flashcard của bạn.");

  const pages = pageResult.data ?? [];
  const signed = await signPaths(
    supabase,
    FLASHCARD_MEDIA_BUCKET,
    pages.flatMap((page) =>
      [page.front_image_path, page.back_image_path, page.audio_path].filter(
        (path): path is string => Boolean(path),
      ),
    ),
    900,
  );
  const pagesBySection = new Map<string, FlashcardPageView[]>();
  for (const page of pages) {
    const group = pagesBySection.get(page.section_id) ?? [];
    group.push({
      ...page,
      frontUrl: signed.get(page.front_image_path) ?? null,
      backUrl: signed.get(page.back_image_path) ?? null,
      audioUrl: page.audio_path
        ? (signed.get(page.audio_path) ?? null)
        : null,
    });
    pagesBySection.set(page.section_id, group);
  }

  return {
    ...deck,
    sections: sections.map((section) => ({
      ...section,
      pages: pagesBySection.get(section.id) ?? [],
    })),
  };
}
