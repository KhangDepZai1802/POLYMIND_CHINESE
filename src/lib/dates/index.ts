import { format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { vi } from "date-fns/locale";

/**
 * MÚI GIỜ — luật cứng của dự án:
 *
 *   • DB LUÔN lưu UTC (timestamptz).
 *   • Người dùng LUÔN thấy giờ Việt Nam.
 *   • Mọi quy đổi đi qua đúng file này. Không tự `new Date(...)` rồi format tay
 *     ở component — sẽ ra giờ máy người dùng, sai khi họ ở múi giờ khác.
 */
export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Ngày kiểu Việt Nam: 20/07/2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "dd/MM/yyyy");
}

/** Ngày + giờ: 20/07/2026 08:00 */
export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "dd/MM/yyyy HH:mm");
}

/** Chỉ giờ: 08:00 */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "HH:mm");
}

/** Khóa ngày yyyy-MM-dd theo giờ Việt Nam, dùng để xếp buổi vào lịch tuần/tháng. */
export function dateKeyInVN(value: string | Date): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

/** Giờ trong cột `time` của Postgres ("08:00:00") → "08:00". Không đổi múi giờ. */
export function formatClock(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

/** Ngày dài có thứ: Thứ Hai, 20/07/2026 */
export function formatDateLong(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "EEEE, dd/MM/yyyy", {
    locale: vi,
  });
}

/** Cho `<input type="date">` — luôn yêu cầu yyyy-MM-dd. */
export function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

/** Cho `<input type="datetime-local">`. */
export function toDateTimeInputValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

/**
 * "2026-07-20T08:00" (giờ VN, từ datetime-local) → Date UTC để lưu DB.
 *
 * Đây là chỗ dễ sai nhất: `new Date("2026-07-20T08:00")` diễn giải chuỗi theo
 * múi giờ CỦA MÁY CHẠY CODE. Trên Vercel (UTC) nó thành 08:00 UTC = 15:00 giờ
 * VN — lệch 7 tiếng, và chỉ lộ ra khi deploy.
 */
export function fromLocalInput(value: string): Date {
  return fromZonedTime(value, APP_TIMEZONE);
}

/** Hôm nay theo giờ VN (không phải theo giờ server). */
export function todayInVN(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/** yyyy-MM-dd của hôm nay theo giờ VN. */
export function todayISO(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

/** Thứ trong tuần theo ISO: 1 = Thứ Hai … 7 = Chủ Nhật. */
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Thứ Hai", short: "T2" },
  { value: 2, label: "Thứ Ba", short: "T3" },
  { value: 3, label: "Thứ Tư", short: "T4" },
  { value: 4, label: "Thứ Năm", short: "T5" },
  { value: 5, label: "Thứ Sáu", short: "T6" },
  { value: 6, label: "Thứ Bảy", short: "T7" },
  { value: 7, label: "Chủ Nhật", short: "CN" },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((w) => w.value === weekday)?.label ?? "—";
}

/** Tiền Việt: 1.500.000 ₫ */
export function formatCurrency(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Phần trăm: 87,5% */
export function formatPercent(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n)}%`;
}

/** Điểm số: 87,5 */
export function formatScore(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n);
}

export { format };
