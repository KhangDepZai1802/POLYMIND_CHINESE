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

/**
 * Khoá học kèm số buổi — dùng cho ô chọn khoá ở màn admin.
 *
 * Bảng `courses` có từ lâu nên ở đây nuốt lỗi thành danh sách rỗng là chấp nhận
 * được: ô chọn rỗng tự nó đã là tín hiệu nhìn thấy được, khác hẳn ca bảng video
 * (xem `AdminVideoData.loadError`).
 */
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

export type AdminVideoData = {
  collection: VideoCollectionView | null;
  /**
   * Lỗi tải, `null` nếu bình thường.
   *
   * 🔴 **Vì sao phải có, và vì sao khác phía học viên:** bản đầu hàm này nuốt
   * lỗi (`return data ?? []`), nên khi bảng chưa tồn tại trên máy chủ — tức
   * migration chưa chạy — màn admin hiện y hệt trạng thái bình thường
   * *"khóa này chưa có bộ video nào"*. Bấm **Tạo bộ video** thì đổ lỗi chung
   * chung, mà trên màn hình không có một dấu hiệu nào chỉ tới nguyên nhân thật.
   *
   * Đây đúng kiểu **hỏng im lặng** mà `AGENTS.md` cấm: một sai sót vận hành đội
   * lốt trạng thái rỗng hợp lệ.
   *
   * Phía **học viên** thì ngược lại — cố ý vẫn nuốt lỗi thành "không có video",
   * vì fail-closed đúng cho người học: thà không thấy tab còn hơn dội một thông
   * báo kỹ thuật vào mặt các em.
   */
  loadError: string | null;
};

/**
 * Lấy bộ video của khoá cho màn admin, kèm lỗi tải nếu có.
 *
 * Gộp hai lượt đọc vào một hàm để phía gọi không tự ghép rồi quên mất vế lỗi.
 * Bản đầu mỗi khóa một bộ nên lấy bộ đầu tiên; schema đã chừa nhiều bộ.
 */
export async function getAdminVideoData(courseId: string): Promise<AdminVideoData> {
  const supabase = await createClient();

  const { data: collections, error: listError } = await supabase
    .from("video_collections")
    .select("*")
    .eq("course_id", courseId)
    .order("position")
    .order("created_at");

  if (listError) {
    return { collection: null, loadError: describeLoadError(listError) };
  }

  const collection = collections?.[0];
  if (!collection) return { collection: null, loadError: null };

  const { data: items, error: itemError } = await supabase
    .from("video_items")
    .select("*")
    .eq("collection_id", collection.id)
    .order("session_number");

  if (itemError) {
    return { collection: null, loadError: describeLoadError(itemError) };
  }

  return {
    collection: { ...collection, items: (items ?? []).map(toView) },
    loadError: null,
  };
}

/**
 * Nói đúng nguyên nhân thay vì "có lỗi xảy ra".
 *
 * 🔴 `PGRST205` là mã THẬT của ca này, đã đo trên REST local (bảng lạ → HTTP 404
 * `PGRST205`). Mã Postgres `42P01` giữ kèm cho các đường chạy SQL thẳng, nhưng
 * app đi qua PostgREST nên nếu chỉ bắt `42P01` thì nhánh này không bao giờ chạy.
 */
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

function describeLoadError(error: { code?: string; message?: string }): string {
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) {
    return "Bảng dữ liệu video chưa có trên máy chủ này — migration 20260805000090_lesson_videos chưa được chạy. Chạy `npx supabase db push` rồi tải lại trang.";
  }
  return "Không tải được danh sách video. Vui lòng tải lại trang.";
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
