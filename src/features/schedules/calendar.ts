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
