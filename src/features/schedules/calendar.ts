import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";

export type CalendarView = "compact" | "week" | "month";

function parseDateKey(value: string): Date {
  return parseISO(value);
}

function toDateKey(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export function pickInitialDateKey(
  sessionDateKeys: string[],
  todayKey: string,
): string {
  const sorted = [...new Set(sessionDateKeys)].sort();
  return (
    sorted.find((dateKey) => dateKey >= todayKey) ?? sorted.at(-1) ?? todayKey
  );
}

export function getWeekDateKeys(anchorKey: string): string[] {
  const start = startOfWeek(parseDateKey(anchorKey), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) =>
    toDateKey(addDays(start, index)),
  );
}

export function getMonthGridDateKeys(anchorKey: string): string[] {
  const anchor = parseDateKey(anchorKey);
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function shiftCalendarAnchor(
  anchorKey: string,
  view: Exclude<CalendarView, "compact">,
  amount: number,
): string {
  const anchor = parseDateKey(anchorKey);
  return toDateKey(
    view === "week" ? addWeeks(anchor, amount) : addMonths(anchor, amount),
  );
}

export function formatCalendarPeriod(
  anchorKey: string,
  view: Exclude<CalendarView, "compact">,
): string {
  if (view === "month") {
    return format(parseDateKey(anchorKey), "'Tháng' M 'năm' yyyy", {
      locale: vi,
    });
  }

  const days = getWeekDateKeys(anchorKey);
  const first = parseDateKey(days[0]!);
  const last = parseDateKey(days[6]!);
  return `${format(first, "dd/MM")} – ${format(last, "dd/MM/yyyy")}`;
}

export function formatCalendarDay(dateKey: string, pattern: string): string {
  return format(parseDateKey(dateKey), pattern, { locale: vi });
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/* ---------------------------------------------------------------------------
 * Bố cục điện thoại (`UX-MOBILE-1`, 2026-08-05)
 *
 * Lưới 7 cột cần 1050px (tuần) / 840px (tháng) nên ở 375px phải vuốt ngang 2–3
 * màn hình. Dưới `xl` cả hai chế độ đổi sang bố cục dọc; những hàm dưới đây là
 * phần TÍNH TOÁN của bố cục đó, tách ra khỏi component để test được mà không
 * cần dựng DOM.
 * ------------------------------------------------------------------------- */

/** Một ngày trong danh sách tuần dạng dọc. */
export type CalendarDaySlot<T> = {
  dateKey: string;
  /** 0 = Thứ Hai … 6 = Chủ Nhật — chỉ số để tra `WEEKDAYS`. */
  weekdayIndex: number;
  items: T[];
  isToday: boolean;
};

/**
 * Bảy ngày của tuần, mỗi ngày kèm buổi học của nó.
 *
 * ⚠️ **Luôn trả đủ 7 phần tử, kể cả ngày không có buổi** — user chốt ngày trống
 * *vẫn hiện* dạng một dòng rút gọn, để người xem giữ được cảm giác "đây là cả
 * tuần" chứ không phải một danh sách trôi nổi. Component quyết định vẽ dòng rút
 * gọn hay thẻ đầy đủ; hàm này không giấu ngày nào.
 */
export function getWeekDaySlots<T>(
  anchorKey: string,
  itemsByDate: Map<string, T[]>,
  todayKey: string,
): CalendarDaySlot<T>[] {
  return getWeekDateKeys(anchorKey).map((dateKey, weekdayIndex) => ({
    dateKey,
    weekdayIndex,
    items: itemsByDate.get(dateKey) ?? [],
    isToday: dateKey === todayKey,
  }));
}

/**
 * Ngày được chọn sẵn khi mở lưới tháng trên điện thoại.
 *
 * Thứ tự ưu tiên: **hôm nay** (nếu nằm trong tháng đang xem và tháng đó có
 * buổi) → **ngày có buổi gần nhất kể từ hôm nay** → **ngày có buổi cuối cùng**
 * → **ngày đầu tháng**. Chọn hôm nay mà hôm nay trống thì panel chi tiết mở ra
 * rỗng — đúng kỹ thuật nhưng vô dụng, nên chỉ giữ hôm nay khi tháng thật sự có
 * buổi để rơi về.
 */
export function pickMonthFocusDateKey(
  anchorKey: string,
  sessionDateKeys: Iterable<string>,
  todayKey: string,
): string {
  const activeMonth = monthKey(anchorKey);
  const inMonth = [...new Set(sessionDateKeys)]
    .filter((dateKey) => monthKey(dateKey) === activeMonth)
    .sort();

  if (inMonth.length === 0) {
    return monthKey(todayKey) === activeMonth ? todayKey : `${activeMonth}-01`;
  }
  if (inMonth.includes(todayKey)) return todayKey;
  return inMonth.find((dateKey) => dateKey >= todayKey) ?? inMonth.at(-1)!;
}
