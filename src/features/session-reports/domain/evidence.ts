/**
 * Minh chứng buổi học (mục 8) — những thứ CẢ BỐN bề mặt đều cần biết.
 *
 * Biểu mẫu của giáo viên, bản xem của giáo vụ, bản in và bản DOCX đều nói về
 * cùng một tập tệp. Tên bucket từng được gõ lại ở ba chỗ (`session-report-form`,
 * `server/actions`, migration); gõ lại là có ngày sửa một chỗ quên hai chỗ kia
 * rồi ảnh tải lên đúng bucket mà ký URL ở bucket khác.
 */

/** Bucket riêng, KHÔNG công khai — đọc phải đi qua URL ký hạn ngắn. */
export const EVIDENCE_BUCKET = "session-report-evidence";

/** Trần ảnh cho mỗi buổi. */
export const MAX_EVIDENCE = 4;

/**
 * URL ký sống bao lâu.
 *
 * 10 phút: đủ cho một lượt mở trang → xem ảnh → Ctrl+P, mà không đủ để một link
 * bị chép ra ngoài còn dùng được vào hôm sau. Ảnh minh chứng có mặt học viên
 * trong đó, nên đây là dữ liệu cá nhân chứ không phải ảnh trang trí.
 */
export const EVIDENCE_URL_TTL_SECONDS = 600;

/**
 * `"<uid>/<session_id>/<uuid>-IMG_2201.webp"` → `"IMG_2201.webp"`.
 *
 * Đường dẫn trong bucket mang theo uid người tải lên và một uuid chống trùng —
 * cả hai đều là chi tiết kỹ thuật, in nguyên si lên báo cáo gửi cấp trên thì
 * vừa rối vừa lộ id nội bộ. Thứ con người cần đọc là tên tệp gốc.
 *
 * Không khớp khuôn (dữ liệu cũ, tên lạ) thì trả về đoạn cuối nguyên vẹn — thà
 * hiện một cái tên xấu còn hơn hiện chuỗi rỗng.
 */
export function evidenceFileName(storagePath: string): string {
  const last = storagePath.split("/").filter(Boolean).pop() ?? storagePath;
  return last.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    "",
  ) || last;
}

/** `204800` → `"200 KB"`. Dùng chung cho biểu mẫu và bản in. */
export function formatEvidenceBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
