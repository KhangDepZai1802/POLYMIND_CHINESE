import "server-only";

import { stripSessionPrefix } from "@/features/videos/domain/youtube-url";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CollectionRow = Database["public"]["Tables"]["video_collections"]["Row"];
type ItemRow = Database["public"]["Tables"]["video_items"]["Row"];

/** Số buổi mặc định khi khoá chưa khai `default_session_count`. */
export const FALLBACK_MAX_SESSION = 60;

export type VideoItemView = ItemRow & {
  /**
   * Tiêu đề đã cắt tiền tố "Buổi N" thừa.
   *
   * User đặt tiêu đề trên YouTube dạng *"Buổi 1. Chào hỏi…"*, mà giao diện đã có
   * badge số riêng — ghép thẳng sẽ ra *"Buổi 1 · Buổi 1. Chào hỏi…"*. Cắt ở tầng
   * query để **cả admin và học viên nhìn thấy y hệt nhau**; tính ở component thì
   * kiểu gì cũng có chỗ quên (đúng mẫu hỏng `BUG_M10_01`).
   */
  displayTitle: string;
};

export type VideoCollectionView = CollectionRow & {
  items: VideoItemView[];
};

export type VideoCourseOption = {
  id: string;
  code: string;
  title: string;
  /** Trần số buổi để chặn dán nhầm `buoi40` vào khoá 35 buổi. */
  maxSessionNumber: number;
};

function toView(row: ItemRow): VideoItemView {
  return { ...row, displayTitle: stripSessionPrefix(row.title, row.session_number) };
}

/** Khoá học kèm số buổi — dùng cho ô chọn khoá ở màn admin. */
export async function getVideoCourseOptions(): Promise<VideoCourseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, code, title, default_session_count")
    .order("code");

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    maxSessionNumber: row.default_session_count ?? FALLBACK_MAX_SESSION,
  }));
}

/** Danh sách bộ video của một khoá (màn admin). */
export async function getAdminVideoCollections(
  courseId: string,
): Promise<CollectionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("video_collections")
    .select("*")
    .eq("course_id", courseId)
    .order("position")
    .order("created_at");

  return data ?? [];
}

/** Một bộ kèm toàn bộ buổi, sắp theo số buổi (màn admin). */
export async function getAdminVideoCollection(
  collectionId: string,
): Promise<VideoCollectionView | null> {
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("video_collections")
    .select("*")
    .eq("id", collectionId)
    .maybeSingle();

  if (!collection) return null;

  const { data: items } = await supabase
    .from("video_items")
    .select("*")
    .eq("collection_id", collectionId)
    .order("session_number");

  return { ...collection, items: (items ?? []).map(toView) };
}

/**
 * Bộ video học viên được xem của một khoá.
 *
 * ⚠️ Không có một dòng `where student_id` nào — **RLS khoanh vùng** (policy
 * `video_collections_student_read` / `video_items_student_read`). Tự lọc thêm ở
 * app là mở đường cho hai nguồn sự thật lệch nhau.
 *
 * Bản đầu user chỉ dùng một bộ/khoá, nên trả về bộ đầu tiên và vào thẳng, không
 * bắt bấm qua màn chọn — đúng cách `MULTIDECK-1f` đã làm cho flashcard.
 */
export async function getStudentVideoCollection(
  courseId: string,
): Promise<VideoCollectionView | null> {
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("video_collections")
    .select("*")
    .eq("course_id", courseId)
    .order("position")
    .limit(1)
    .maybeSingle();

  if (!collection) return null;

  const { data: items } = await supabase
    .from("video_items")
    .select("*")
    .eq("collection_id", collection.id)
    .order("session_number");

  return { ...collection, items: (items ?? []).map(toView) };
}
