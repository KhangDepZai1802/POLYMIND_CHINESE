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

/** Liên kết công khai CÒN HIỆU LỰC của buổi, nếu có (`D-36`). */
export type FlashcardPublicLinkView = {
  id: string;
  token: string;
  created_at: string;
};

export type FlashcardSectionView = SectionRow & {
  pages: FlashcardPageView[];
  publicLink: FlashcardPublicLinkView | null;
};

export type FlashcardDeckView = DeckRow & {
  sections: FlashcardSectionView[];
};

export type FlashcardCourseOption = {
  id: string;
  code: string;
  title: string;
  defaultSessionCount: number | null;
  /**
   * Số bộ thẻ của khoá. Từ `MULTIDECK-1` một khoá có nhiều bộ nên đây là **số
   * đếm**, không còn là "bộ duy nhất hay `null`" — ô chọn khoá dùng nó để nói
   * trước khoá nào đã có nội dung.
   */
  deckCount: number;
};

/** Một dòng trong danh sách bộ thẻ ở cột trái màn Admin (`MULTIDECK-1e`). */
export type FlashcardDeckSummary = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: DeckRow["status"];
  sectionCount: number;
  publishedSectionCount: number;
  /** Bộ còn liên kết công khai sống thì KHÔNG đổi được mã (`MULTIDECK-1c`). */
  liveLinkCount: number;
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
    const group = pagesBySection.get(page.section_id) ?? [];
    group.push(attachSignedMedia(page, signed));
    pagesBySection.set(page.section_id, group);
  }
  return pagesBySection;
}

/**
 * Gắn URL đã ký vào một trang.
 *
 * Tách khỏi `signPagesBySection` để **trang công khai** (`public-queries.ts`)
 * dùng lại nguyên vẹn thay vì chép bản thứ hai. Chép ra hai bản là đúng hình
 * dạng `UX-UIUX-M25-010` mà comment ngay phía trên đang cảnh báo — chỉ khác là
 * lần này chỗ trôi sẽ là ảnh của học sinh quét mã QR.
 *
 * Nhận `T extends { … }` chứ không phải `PageRow` vì payload công khai cố ý
 * KHÔNG mang `id`/`section_id`/`created_by`.
 */
export function attachSignedMedia<
  T extends {
    front_image_path: string | null;
    back_image_path: string | null;
    audio_path: string | null;
    media_paths: string[];
  },
>(
  page: T,
  signed: Map<string, string>,
): T & {
  frontUrl: string | null;
  backUrl: string | null;
  audioUrl: string | null;
  mediaUrls: Record<string, string>;
} {
  const mediaUrls: Record<string, string> = {};
  for (const path of page.media_paths) {
    const url = signed.get(path);
    if (url) mediaUrls[path] = url;
  }

  return {
    ...page,
    frontUrl: page.front_image_path
      ? (mediaUrls[page.front_image_path] ?? null)
      : null,
    backUrl: page.back_image_path
      ? (mediaUrls[page.back_image_path] ?? null)
      : null,
    audioUrl: page.audio_path ? (mediaUrls[page.audio_path] ?? null) : null,
    mediaUrls,
  };
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
    deckCount: course.flashcard_decks?.length ?? 0,
  }));
}

/**
 * Danh sách bộ thẻ của một khoá — cột trái màn Admin (`MULTIDECK-1`).
 *
 * Sắp theo `code` chứ không theo `created_at`: mã bộ là thứ người dùng đọc trên
 * địa chỉ QR, nên xếp theo nó thì thứ tự trên màn hình khớp thứ tự trong bảng
 * tính đưa cho bên in.
 */
export async function getAdminFlashcardDecks(
  courseId: string,
): Promise<FlashcardDeckSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .select("id,code,title,description,status,flashcard_sections(id,status)")
    .eq("course_id", courseId)
    .order("code");
  if (error) throw new Error("Không tải được danh sách bộ flashcard.");

  const deckIds = (data ?? []).map((deck) => deck.id);
  // Đếm liên kết SỐNG theo bộ. Truy từ `flashcard_sections` chứ không từ
  // `flashcard_public_links` vì bảng liên kết chỉ mang `section_id` — nó cố ý
  // không biết gì về bộ thẻ.
  const linkResult =
    deckIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("flashcard_public_links")
          .select("id,section:flashcard_sections!inner(deck_id)")
          .in("section.deck_id", deckIds)
          .is("revoked_at", null);
  if (linkResult.error) {
    throw new Error("Không tải được liên kết công khai.");
  }

  const liveLinksByDeck = new Map<string, number>();
  for (const row of linkResult.data ?? []) {
    const deckId = row.section?.deck_id;
    if (!deckId) continue;
    liveLinksByDeck.set(deckId, (liveLinksByDeck.get(deckId) ?? 0) + 1);
  }

  return (data ?? []).map((deck) => {
    const sections = deck.flashcard_sections ?? [];
    return {
      id: deck.id,
      code: deck.code,
      title: deck.title,
      description: deck.description,
      status: deck.status,
      sectionCount: sections.length,
      publishedSectionCount: sections.filter(
        (section) => section.status === "published",
      ).length,
      liveLinkCount: liveLinksByDeck.get(deck.id) ?? 0,
    };
  });
}

/**
 * Một bộ thẻ đầy đủ, tra theo **id của bộ**.
 *
 * Trước `MULTIDECK-1` hàm này tra theo `course_id` và dùng `.maybeSingle()` —
 * đúng chừng nào mỗi khoá chỉ có một bộ. Khoá hai bộ thì `.maybeSingle()` ném
 * lỗi ngay, nên đường tra buộc phải đổi chứ không phải "nên đổi".
 */
export async function getAdminFlashcardDeck(
  deckId: string,
): Promise<FlashcardDeckView | null> {
  const supabase = await createClient();
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .select("*")
    .eq("id", deckId)
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

  // Liên kết công khai còn hiệu lực. RLS đã giới hạn về super_admin nên không
  // lặp lại điều kiện đó ở đây; `revoked_at is null` là vế nghiệp vụ, không
  // phải vế phân quyền.
  const linkResult =
    sectionIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("flashcard_public_links")
          .select("id,token,created_at,section_id")
          .in("section_id", sectionIds)
          .is("revoked_at", null);
  if (linkResult.error) {
    throw new Error("Không tải được liên kết công khai.");
  }
  const linkBySection = new Map(
    (linkResult.data ?? []).map((row) => [
      row.section_id,
      { id: row.id, token: row.token, created_at: row.created_at },
    ]),
  );

  return {
    ...deck,
    sections: sections.map((section) => ({
      ...section,
      pages: pagesBySection.get(section.id) ?? [],
      publicLink: linkBySection.get(section.id) ?? null,
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

/** Bộ thẻ đã công bố của khoá, dạng rút gọn — màn chọn bộ của học viên. */
export type StudentFlashcardDeckOption = {
  id: string;
  title: string;
  description: string | null;
  sectionCount: number;
};

/**
 * Các bộ thẻ học viên xem được của một khoá (`MULTIDECK-1f`).
 *
 * Cố ý **không** kéo theo trang và **không** ký URL nào: màn chọn bộ chỉ cần
 * tên và số buổi. Ký media của mọi bộ chỉ để vẽ vài cái thẻ chọn là trả giá
 * đúng thứ `PERF-IMG-1` vừa mất một phiên để gỡ.
 *
 * RLS đã lọc `published` + đúng khoá của học viên; điều kiện `status` ở đây là
 * vế nghiệp vụ (bộ nháp không hiện), không phải vế phân quyền.
 */
export async function getStudentFlashcardDeckOptions(
  courseId: string,
): Promise<StudentFlashcardDeckOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .select("id,title,description,flashcard_sections(id,status)")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("code");
  if (error) throw new Error("Không tải được bộ flashcard của bạn.");

  return (data ?? []).map((deck) => ({
    id: deck.id,
    title: deck.title,
    description: deck.description,
    sectionCount: (deck.flashcard_sections ?? []).filter(
      (section) => section.status === "published",
    ).length,
  }));
}

/**
 * Một bộ thẻ đầy đủ cho học viên, tra theo **id của bộ**.
 *
 * Cùng lý do đổi chữ ký như `getAdminFlashcardDeck`: `.maybeSingle()` trên
 * `course_id` ném lỗi ngay khi khoá có bộ thứ hai.
 */
export async function getStudentFlashcardDeck(
  deckId: string,
): Promise<FlashcardDeckView | null> {
  const supabase = await createClient();
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .select("*")
    .eq("id", deckId)
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
      // Học viên không cần biết buổi này có được chia sẻ công khai hay không.
      publicLink: null,
    })),
  };
}
