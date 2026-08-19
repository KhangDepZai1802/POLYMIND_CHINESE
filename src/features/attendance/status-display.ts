import type { AttendanceStatus } from "@/features/reports/learning";

/**
 * Ký hiệu + màu của bốn trạng thái điểm danh — MỘT bảng, mọi lưới dùng chung.
 *
 * =============================================================================
 * VÌ SAO TÁCH RA KHỎI `attendance-grid.tsx`
 * =============================================================================
 *
 * Bảng này vốn là hằng số cục bộ trong component lưới chỉ-đọc của tab Học tập.
 * Tab Điểm danh (`ADMIN-ATTENDANCE-1`) cần đúng bộ ký hiệu đó cho lưới SỬA
 * ĐƯỢC. Chép sang là dựng hai bảng cho cùng một khái niệm: đổi màu "vắng" ở một
 * chỗ rồi cùng một buổi học đọc ra hai kiểu ở hai tab — đúng hình dạng
 * `BUG_M10_01` mà `CLAUDE.md` liệt kê.
 *
 * 🔴 KÝ HIỆU LÀ CHỮ, KHÔNG PHẢI MÀU (`color-not-only`). Người không phân biệt
 * được màu vẫn đọc được ✓/M/V/P; màu chỉ là lớp nhấn thêm.
 */
export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "excused",
] as const satisfies readonly AttendanceStatus[];

export const ATTENDANCE_CELL: Record<
  AttendanceStatus,
  { symbol: string; label: string; className: string }
> = {
  present: {
    symbol: "✓",
    label: "Có mặt",
    className: "bg-success/10 text-success",
  },
  late: {
    symbol: "M",
    label: "Đi muộn",
    className: "bg-warning/10 text-warning",
  },
  absent: {
    symbol: "V",
    label: "Vắng",
    className: "bg-destructive/10 text-danger-ink",
  },
  excused: {
    symbol: "P",
    label: "Có phép",
    className: "bg-muted text-text-secondary",
  },
};

/** Ô chưa điểm danh — trạng thái thứ NĂM, khác hẳn "vắng". */
export const UNMARKED_SYMBOL = "—";
export const UNMARKED_LABEL = "Chưa điểm danh";
