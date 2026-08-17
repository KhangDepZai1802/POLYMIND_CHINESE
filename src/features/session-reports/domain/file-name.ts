/**
 * TÊN FILE của một báo cáo buổi dạy — `LOP-03_Buoi-4_17-08-2026`.
 *
 * =============================================================================
 * MỘT HÀM CHO CẢ HAI BỀ MẶT (user chốt 2026-08-17)
 * =============================================================================
 *
 * Giáo vụ xuất từ `/admin/reports/bao-cao/[reportId]`, giáo viên xuất từ
 * `/teacher/reports/[sessionId]/ban-in`. User yêu cầu **cùng một tên file** ở
 * hai chỗ, nên hai chỗ gọi đúng hàm này. Ghép chuỗi riêng ở từng trang là có
 * ngày hai bên đặt tên khác nhau cho cùng một buổi — đúng hình dạng
 * `BUG_M10_01`.
 *
 * =============================================================================
 * 🔴 KHÔNG CÓ ĐUÔI `.pdf` TRONG `sessionReportFileBase()`
 * =============================================================================
 *
 * Bản PDF ra bằng **hộp thoại In của trình duyệt** (user chốt: không thêm thư
 * viện PDF). Chrome/Edge/Firefox lấy `document.title` làm tên file gợi ý **rồi
 * tự thêm `.pdf`** — để sẵn đuôi trong tiêu đề là ra `....pdf.pdf`. Vì vậy:
 *
 *   • `sessionReportFileBase()` → gán vào `document.title` trước khi in.
 *   • `sessionReportPdfName()`  → chỉ dùng khi cần NÓI ra tên file (nhãn trợ
 *     năng, tài liệu, bài kiểm), không bao giờ gán vào `document.title`.
 *
 * =============================================================================
 * VÌ SAO BỎ DẤU
 * =============================================================================
 *
 * User chọn `LOP-03_Buoi-4_17-08-2026.pdf` thay vì `LOP-03_Buổi 4_...`: file
 * này đi qua Zalo, email, máy in mạng và thư mục Windows của giáo vụ — mấy
 * đường đó vẫn còn chỗ làm hỏng dấu tiếng Việt thành ký tự lạ.
 */

import { formatDateForFileName } from "@/lib/dates";

/** `đ`/`Đ` KHÔNG phải tổ hợp dấu nên `normalize("NFD")` không tách được. */
const D_STROKE = /[đĐ]/g;

/**
 * Dấu tổ hợp mà `normalize("NFD")` tách ra khỏi nguyên âm.
 *
 * Dùng thuộc tính Unicode `\p{Diacritic}` chứ KHÔNG dán dải ký tự dấu thật vào
 * source: dấu thật trong regex là thứ không ai đọc lại được lúc review, và một
 * số editor còn tự chuẩn hoá nó thành dạng khác.
 */
const COMBINING_MARKS = /\p{Diacritic}/gu;

/**
 * Bỏ dấu tiếng Việt và mọi ký tự không an toàn cho tên file.
 *
 * Giữ lại chữ/số/gạch nối; thứ còn lại (dấu cách, `/`, `:`, `?`, emoji…) thành
 * một gạch nối. Mã lớp hiện tại là `LOP-03` nên hàm này gần như không phải làm
 * gì — nó ở đây cho ngày ai đó đặt mã lớp là `Lớp Sơ cấp 1/2026`.
 */
function fileSafe(value: string): string {
  return value
    .replace(D_STROKE, (char) => (char === "đ" ? "d" : "D"))
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export type SessionReportFileParts = {
  /** Mã lớp, ví dụ `LOP-03`. */
  classCode: string | null | undefined;
  /** Số buổi trong lớp — `4` trong "Buổi 4". */
  sessionNumber: number | null | undefined;
  /**
   * MỐC THẬT của buổi học (ISO từ `class_sessions.starts_at`), KHÔNG phải chuỗi
   * `17/08/2026` đã định dạng để hiển thị.
   *
   * 🔴 Ghi rõ vì `TEACHER-REPORT-4b` đã trả giá đúng một lần cho chuyện dùng
   * chung một trường cho hai ý nghĩa: dòng "Thời gian" từng in
   * `10/08/2026 – 09:30` vì mốc bắt đầu đọc từ chuỗi đã format thành ngày.
   */
  startsAt: string | Date | null | undefined;
};

/**
 * `LOP-03_Buoi-4_17-08-2026` — chưa có đuôi file (xem chú thích đầu file).
 *
 * Thiếu phần nào thì **bỏ đúng phần đó**, không nhồi chuỗi rỗng để giữ dấu `_`:
 * `LOP-03__17-08-2026` trông như file lỗi. Thiếu tất cả thì trả
 * `bao-cao-buoi-day` để không bao giờ sinh ra một tên file rỗng.
 */
export function sessionReportFileBase(parts: SessionReportFileParts): string {
  const segments: string[] = [];

  const classCode = fileSafe(parts.classCode?.trim() ?? "");
  if (classCode) segments.push(classCode);

  const { sessionNumber } = parts;
  if (
    typeof sessionNumber === "number" &&
    Number.isInteger(sessionNumber) &&
    sessionNumber > 0
  ) {
    segments.push(`Buoi-${sessionNumber}`);
  }

  const day = formatDateForFileName(parts.startsAt);
  if (day) segments.push(day);

  return segments.length > 0 ? segments.join("_") : "bao-cao-buoi-day";
}

/** Tên file đầy đủ — chỉ để NÓI ra, không gán vào `document.title`. */
export function sessionReportPdfName(parts: SessionReportFileParts): string {
  return `${sessionReportFileBase(parts)}.pdf`;
}
