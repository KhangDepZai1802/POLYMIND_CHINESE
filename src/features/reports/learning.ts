import { fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/dates";

import type { LearningReportFilters } from "./schema";

/**
 * Phần TÍNH TOÁN THUẦN của báo cáo học tập (`REPORT-REDESIGN-1`).
 *
 * Mọi hàm ở đây nhận dữ liệu vào, trả kết quả ra, không đụng DB — để unit test
 * ghim được công thức mà không cần Supabase. Query ở `server/learning-queries.ts`
 * chỉ việc gọi.
 *
 * Quy ước ngày: mọi "ngày" trong file này là chuỗi `yyyy-MM-dd` THEO GIỜ VN
 * (đi ra từ `dateKeyInVN`). Chỉ khi cần mốc UTC để so với `starts_at` mới đổi
 * qua `periodToUtcRange`.
 */

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

/** Tỉ lệ chuyên cần — ĐÚNG công thức `v_student_attendance_summary`: (có mặt + muộn) / tổng buổi. */
export function attendanceRate(
  present: number,
  late: number,
  totalSessions: number,
): number | null {
  if (totalSessions <= 0) return null;
  return round1((100 * (present + late)) / totalSessions);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Buổi đã diễn ra trong kỳ nhưng chưa được điểm danh — tính như vắng trong mẫu số (theo view DB). */
  unmarked: number;
  totalSessions: number;
  rate: number | null;
};

export function summarizeAttendance(
  statuses: readonly AttendanceStatus[],
  totalSessions: number,
): AttendanceSummary {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const status of statuses) counts[status] += 1;
  return {
    ...counts,
    unmarked: Math.max(0, totalSessions - statuses.length),
    totalSessions,
    rate: attendanceRate(counts.present, counts.late, totalSessions),
  };
}

/** Trung bình đã làm tròn 1 chữ số thập phân; mảng rỗng → null (chưa có dữ liệu ≠ 0 điểm). */
export function averageScore(scores: readonly number[]): number | null {
  if (scores.length === 0) return null;
  return round1(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

/** Điểm bài tập quy về thang 100 như `v_enrollment_assessment_progress`. */
export function exerciseScoreOn100(
  finalScore: number,
  maxScore: number,
): number | null {
  if (maxScore <= 0) return null;
  return (finalScore / maxScore) * 100;
}

// ---------------------------------------------------------------------------
// Kỳ báo cáo
// ---------------------------------------------------------------------------

export type LearningPeriod = {
  /** `yyyy-MM-dd` theo giờ VN; null = không chặn đầu đó (Toàn khóa). */
  from: string | null;
  to: string | null;
  preset: "week" | "month" | "all" | "custom";
  /** Nhãn người đọc: "Tháng 8/2026", "Toàn khóa"… — dùng cho tiêu đề trang in. */
  label: string;
};

const DAY_MS = 86_400_000;

function utcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateKey: string, days: number): string {
  return toKey(new Date(utcDate(dateKey).getTime() + days * DAY_MS));
}

/** Thứ Hai của tuần chứa ngày này (ISO — tuần bắt đầu Thứ Hai). */
export function mondayOf(dateKey: string): string {
  const date = utcDate(dateKey);
  const day = date.getUTCDay() || 7;
  return addDays(dateKey, 1 - day);
}

export function monthRangeOf(dateKey: string): { from: string; to: string } {
  const date = utcDate(dateKey);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    from: toKey(new Date(Date.UTC(y, m, 1))),
    to: toKey(new Date(Date.UTC(y, m + 1, 0))),
  };
}

export function weekRangeOf(dateKey: string): { from: string; to: string } {
  const from = mondayOf(dateKey);
  return { from, to: addDays(from, 6) };
}

function formatVN(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Chốt kỳ báo cáo từ filter trên URL.
 *
 * `defaultPreset` do trang quyết: admin mở trang trắng thấy **Tháng này**
 * (AC1.1), giáo viên thấy **Toàn khóa** — giữ đúng số liệu lũy kế mà e2e
 * `report.smoke.spec.ts` đang đối chiếu thẳng với `count(*)` trong DB.
 */
export function resolveLearningPeriod(
  filters: LearningReportFilters,
  todayKey: string,
  defaultPreset: "month" | "all",
): LearningPeriod {
  const month = monthRangeOf(todayKey);
  const week = weekRangeOf(todayKey);

  if (filters.range === "all") {
    return { from: null, to: null, preset: "all", label: "Toàn khóa" };
  }

  const from = filters.from ?? null;
  const to = filters.to ?? null;

  if (!from && !to) {
    if (defaultPreset === "all") {
      return { from: null, to: null, preset: "all", label: "Toàn khóa" };
    }
    return {
      from: month.from,
      to: month.to,
      preset: "month",
      label: monthLabel(month.from),
    };
  }

  if (from === week.from && to === week.to) {
    return {
      from,
      to,
      preset: "week",
      label: `Tuần này (${formatVN(week.from)} – ${formatVN(week.to)})`,
    };
  }
  if (from === month.from && to === month.to) {
    return { from, to, preset: "month", label: monthLabel(month.from) };
  }

  const label =
    from && to
      ? `Từ ${formatVN(from)} đến ${formatVN(to)}`
      : from
        ? `Từ ${formatVN(from)}`
        : `Đến ${formatVN(to as string)}`;
  return { from, to, preset: "custom", label };
}

function monthLabel(firstDayKey: string): string {
  const [y, m] = firstDayKey.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/**
 * Đổi kỳ (ngày VN) → khoảng UTC để so với `starts_at` (timestamptz).
 * Mốc cuối là **exclusive** (00:00 VN của ngày kế tiếp) — dùng `.lt()`.
 */
export function periodToUtcRange(period: LearningPeriod): {
  fromUtc: string | null;
  toUtcExclusive: string | null;
} {
  return {
    fromUtc: period.from
      ? fromZonedTime(`${period.from}T00:00:00`, APP_TIMEZONE).toISOString()
      : null,
    toUtcExclusive: period.to
      ? fromZonedTime(
          `${addDays(period.to, 1)}T00:00:00`,
          APP_TIMEZONE,
        ).toISOString()
      : null,
  };
}

// ---------------------------------------------------------------------------
// Tuần ISO cho biểu đồ xu hướng
// ---------------------------------------------------------------------------

export function isoWeekOf(dateKey: string): { year: number; week: number } {
  const date = utcDate(dateKey);
  const day = date.getUTCDay() || 7;
  // Neo về Thứ Năm của tuần — chuẩn ISO-8601: tuần thuộc về năm chứa Thứ Năm đó.
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
  return { year: isoYear, week };
}

export type WeeklyTrendPoint = {
  /** Khóa sắp xếp, ví dụ "2026-W32". */
  key: string;
  /** Nhãn trục: "T32". */
  label: string;
  /** Thứ Hai của tuần — để tooltip/aria đọc thành ngày cụ thể. */
  weekStart: string;
  rate: number | null;
  sessionCount: number;
};

export type TrendSession = {
  id: string;
  classId: string;
  /** `yyyy-MM-dd` theo giờ VN (đã qua `dateKeyInVN`). */
  dateKey: string;
};

export type TrendRecord = {
  sessionId: string;
  status: AttendanceStatus;
};

/**
 * Gom buổi theo tuần ISO và tính tỉ lệ chuyên cần từng tuần.
 *
 * Mẫu số của một buổi = sĩ số đang học của lớp đó (`expectedByClass`) — cùng
 * triết lý với view DB: buổi đã qua mà chưa điểm danh thì vẫn nằm trong mẫu
 * số, không được "biến mất" làm tỉ lệ đẹp lên.
 */
export function buildWeeklyTrend(
  sessions: readonly TrendSession[],
  records: readonly TrendRecord[],
  expectedByClass: ReadonlyMap<string, number>,
): WeeklyTrendPoint[] {
  const attendedBySession = new Map<string, number>();
  for (const record of records) {
    if (record.status === "present" || record.status === "late") {
      attendedBySession.set(
        record.sessionId,
        (attendedBySession.get(record.sessionId) ?? 0) + 1,
      );
    }
  }

  const weeks = new Map<
    string,
    { label: string; weekStart: string; attended: number; expected: number; sessionCount: number }
  >();
  for (const session of sessions) {
    const { year, week } = isoWeekOf(session.dateKey);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const entry = weeks.get(key) ?? {
      label: `T${week}`,
      weekStart: mondayOf(session.dateKey),
      attended: 0,
      expected: 0,
      sessionCount: 0,
    };
    entry.attended += attendedBySession.get(session.id) ?? 0;
    entry.expected += expectedByClass.get(session.classId) ?? 0;
    entry.sessionCount += 1;
    weeks.set(key, entry);
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      weekStart: entry.weekStart,
      rate:
        entry.expected > 0
          ? round1((100 * entry.attended) / entry.expected)
          : null,
      sessionCount: entry.sessionCount,
    }));
}
