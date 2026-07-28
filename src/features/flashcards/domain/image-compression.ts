/**
 * LUẬT NÉN ẢNH FLASHCARD — thuần, không DOM, không canvas.
 *
 * Vì sao tồn tại (`PERF-IMG-1`, user báo 2026-07-27: *"bấm qua trang mới rồi mà
 * hình vẫn chưa load và phải đợi rất lâu"*): trước đợt này ảnh đi thẳng từ máy
 * admin lên bucket **nguyên bản gốc** — không một bước resize/nén nào trong cả
 * repo — rồi được vẽ ra bằng `<Image unoptimized>`, tức Next cũng bị tắt hẳn
 * khâu tối ưu. Học viên vì thế tải ảnh 3000px về để vẽ vào ô rộng 320px.
 *
 * Phần quyết định nằm ở đây, phần chạm trình duyệt nằm ở `client/compress-image.ts`.
 * Tách ra không phải cho gọn: `canvas.toBlob` không chạy được trong jsdom, nên
 * gộp chung là mất luôn khả năng kiểm bằng unit test đúng những chỗ dễ sai nhất
 * (làm tròn kích thước, đổi đuôi file, và cái bẫy `toBlob` im lặng đổi định dạng).
 */

/**
 * Cạnh dài tối đa sau khi nén.
 *
 * Vùng thẻ rộng nhất trong toàn hệ là `max-w-2xl` (672px) ở màn Ôn tập trên
 * laptop. 1280px cho màn hình `devicePixelRatio = 2` vẫn dư, mà vẫn cắt được
 * ~85% số điểm ảnh của một tấm 3000px.
 */
export const FLASHCARD_IMAGE_MAX_EDGE = 1280;

/** Ngưỡng chất lượng cho WebP/JPEG. 0.82 là chỗ mắt thường chưa thấy khác. */
export const FLASHCARD_IMAGE_QUALITY = 0.82;

/**
 * Dưới ngưỡng này thì thôi, giữ nguyên file gốc.
 *
 * Nén lại một tấm đã nhẹ sẵn chỉ đổi lấy vài KB nhưng vẫn mất một vòng giải mã
 * → mã hoá, và mỗi vòng như vậy là một lần ảnh xuống cấp thêm.
 */
export const FLASHCARD_IMAGE_SKIP_BYTES = 200 * 1024;

export type ImageSize = { width: number; height: number };

/**
 * Thu kích thước cho cạnh dài về `maxEdge`, giữ đúng tỉ lệ.
 *
 * ⛔ KHÔNG BAO GIỜ phóng to: ảnh nhỏ hơn ngưỡng trả về nguyên si. Phóng to chỉ
 * làm file nặng thêm mà không thêm một chi tiết nào — đúng chiều ngược với việc
 * hàm này sinh ra để làm.
 */
export function fitWithinMaxEdge(
  size: ImageSize,
  maxEdge: number = FLASHCARD_IMAGE_MAX_EDGE,
): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return { width: size.width, height: size.height };

  const ratio = maxEdge / longest;
  // `max(1, …)`: ảnh cực dẹt (vd. 4000×3) làm cạnh ngắn tròn xuống 0, mà canvas
  // 0px thì `toBlob` trả `null` và cả lượt nén rơi về file gốc một cách khó hiểu.
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

/** Ảnh đã vừa khung VÀ đã nhẹ sẵn thì không cần đụng tới. */
export function needsCompression(input: {
  bytes: number;
  size: ImageSize;
}): boolean {
  const longest = Math.max(input.size.width, input.size.height);
  return longest > FLASHCARD_IMAGE_MAX_EDGE || input.bytes > FLASHCARD_IMAGE_SKIP_BYTES;
}

/**
 * MIME thật của blob → đuôi file.
 *
 * 🔴 Đây là chốt chặn cho cái bẫy lớn nhất của `canvas.toBlob`: xin `image/webp`
 * ở trình duyệt không hỗ trợ thì nó **không báo lỗi**, mà lặng lẽ trả về PNG.
 * Nếu tin lời mình xin thay vì đọc `blob.type` thì file PNG sẽ được đặt tên
 * `.webp` và khai `image/webp` — server ký đường dẫn theo đuôi đó, rồi bước soi
 * `flashcardMediaFormat(slot, path, contentType)` ở `actions.ts` mới phát hiện
 * lệch và **vứt cả lượt tải lên**. Luôn đọc kiểu THẬT của thứ nhận được.
 */
export function imageExtensionFromMime(
  mimeType: string | null | undefined,
): "jpg" | "png" | "webp" | null {
  const normalized = (mimeType ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return null;
}

/**
 * `"01-胡萝卜.JPG"` + `"webp"` → `"01-胡萝卜.webp"`.
 *
 * Chỉ đổi phần đuôi cuối cùng và giữ nguyên phần gốc, vì phần gốc chính là thứ
 * `matchFlashcardMediaFiles` dùng để ghép file với thẻ (số thứ tự / Hán tự /
 * pinyin). Đổi nhầm phần đó là ảnh rơi sang thẻ khác.
 */
export function compressedFileName(
  originalName: string,
  extension: "jpg" | "png" | "webp",
): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot <= 0 ? originalName : originalName.slice(0, dot);
  return `${stem}.${extension}`;
}

/**
 * Bản nén có đáng dùng không.
 *
 * Không phải lúc nào cũng đáng: ảnh đồ hoạ phẳng (biểu đồ, chữ trên nền trắng)
 * ở dạng PNG có thể **phình ra** khi mã hoá lại. Nhỏ hơn thì lấy, không thì
 * trả về bản gốc — luật một dòng nhưng là chỗ duy nhất quyết định điều đó.
 */
export function shouldUseCompressed(input: {
  originalBytes: number;
  compressedBytes: number;
}): boolean {
  return input.compressedBytes > 0 && input.compressedBytes < input.originalBytes;
}
