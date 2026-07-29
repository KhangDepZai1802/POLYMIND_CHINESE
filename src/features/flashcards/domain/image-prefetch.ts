import {
  flashcardMediaSlotFromFileName,
  isAudioSlot,
} from "@/features/flashcards/domain/media";

/**
 * CHỌN ẢNH ĐỂ TẢI TRƯỚC — thuần, không React, không DOM (`PERF-IMG-1`).
 *
 * Vì sao cần (user báo 2026-07-27): *"bấm qua trang mới rồi mà hình vẫn chưa
 * load"*. Chỉ thẻ ĐANG XEM nằm trong DOM — cả hai trình đọc đều dựng đúng một
 * thẻ — nên trình duyệt chỉ bắt đầu tải ảnh của thẻ kế tiếp **sau khi** học viên
 * đã bấm sang nó. Toàn bộ thời gian chờ vì thế nằm chình ình trước mặt.
 *
 * Điều kiện để chữa được rẻ như vậy: URL của **cả buổi** đã nằm sẵn ở client
 * ngay từ lượt tải trang (`queries.ts` ký cho cả bộ thẻ, `public-queries.ts` ký
 * cho cả buổi), nên tải trước KHÔNG tốn thêm một request server nào.
 */

/**
 * Tải trước bao nhiêu thẻ: **cả buổi** về phía trước, 1 thẻ về phía sau.
 *
 * 🔴 Trước `PERF-IMG-2` con số này là 3, và đó là cách nghĩ của thời ảnh còn
 * nặng 3,8MB. Sau khi ảnh về ~27KB thì cả buổi 18 thẻ chỉ còn ~500KB — nhẹ hơn
 * MỘT tấm ảnh cũ. Giữ trần 3 lúc đó chỉ còn là tự trói: học viên vuốt nhanh quá
 * 3 thẻ là lại gặp đúng cái vòng chờ mà tính năng này sinh ra để xoá.
 *
 * Phanh KHÔNG nằm ở con số này mà nằm ở **ngân sách thời gian** trong
 * `use-flashcard-image-prefetch.ts`: mạng yếu hoặc ảnh còn nặng thì hàng đợi tự
 * dừng sớm. Đó là phanh đo được, thay cho một con số đoán trước.
 *
 * Lùi 1 là đủ: thẻ vừa rời khỏi gần như chắc chắn còn trong cache.
 */
export const FLASHCARD_PREFETCH_BEHIND = 1;

/** Đúng phần payload cần đọc — cố ý không nhận cả `FlashcardPageView`. */
export type FlashcardPrefetchPage = {
  frontUrl: string | null;
  backUrl: string | null;
  mediaUrls: Record<string, string>;
};

/**
 * Đường dẫn này là ẢNH hay AUDIO?
 *
 * `mediaUrls` mang **mọi** media của thẻ, gồm cả file phát âm. Hỏi ngược
 * `media.ts` thay vì tự liệt kê đuôi file: liệt kê lại là nguồn sự thật thứ hai
 * cho cùng một luật (`BUG_M10_01`). Đường dẫn lạ → trả `false`, tức không tải
 * trước — chọn phía an toàn, vì tải nhầm một file 20MB bằng thẻ `<img>` thì
 * vừa hỏng vừa tốn đúng thứ đang cố tiết kiệm.
 */
function isImagePath(objectPath: string): boolean {
  const slot = flashcardMediaSlotFromFileName(objectPath.split("/").at(-1) ?? "");
  return slot !== null && !isAudioSlot(slot);
}

/** Mọi URL ảnh của MỘT thẻ: hai mặt + ảnh của từng câu ví dụ. */
export function flashcardPageImageUrls(
  page: FlashcardPrefetchPage,
): string[] {
  const urls: string[] = [];
  if (page.frontUrl) urls.push(page.frontUrl);
  if (page.backUrl) urls.push(page.backUrl);
  for (const [path, url] of Object.entries(page.mediaUrls)) {
    if (url && isImagePath(path)) urls.push(url);
  }
  return [...new Set(urls)];
}

/**
 * URL cần tải trước khi đang đứng ở thẻ `index`.
 *
 * Thứ tự trả về là thứ tự **ưu tiên tải**: thẻ kế tiếp trước, rồi mới xa dần,
 * cuối cùng là thẻ lùi. Trình duyệt chỉ mở ~6 kết nối một lúc nên thứ tự này là
 * thứ thật sự quyết định thẻ nào kịp sẵn sàng.
 *
 * Thẻ ĐANG XEM cố ý không có trong danh sách: nó đã nằm trong DOM và đang tải
 * theo đường thường rồi.
 */
export function flashcardPrefetchUrls(
  pages: readonly FlashcardPrefetchPage[],
  index: number,
  options?: { ahead?: number; behind?: number },
): string[] {
  // Mặc định: hết buổi. Danh sách trả về theo thứ tự ưu tiên nên "lấy hết" không
  // đồng nghĩa "tải hết bằng mọi giá" — bên gọi dừng khi hết ngân sách.
  const ahead = options?.ahead ?? pages.length;
  const behind = options?.behind ?? FLASHCARD_PREFETCH_BEHIND;

  const order: number[] = [];
  for (let step = 1; step <= ahead; step += 1) order.push(index + step);
  for (let step = 1; step <= behind; step += 1) order.push(index - step);

  const urls: string[] = [];
  for (const target of order) {
    const page = pages[target];
    if (!page) continue;
    urls.push(...flashcardPageImageUrls(page));
  }
  return [...new Set(urls)];
}
