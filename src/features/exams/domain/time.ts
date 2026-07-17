import { formatInTimeZone } from "date-fns-tz";

const ZONE = "Asia/Ho_Chi_Minh";

export function isSameVietnamDate(opensAt: Date, closesAt: Date) {
  return (
    formatInTimeZone(opensAt, ZONE, "yyyy-MM-dd") ===
    formatInTimeZone(closesAt, ZONE, "yyyy-MM-dd")
  );
}

export function examDeadline(
  startedAt: Date,
  closesAt: Date,
  durationMinutes: number,
) {
  const durationDeadline = new Date(
    startedAt.getTime() + durationMinutes * 60_000,
  );
  return durationDeadline < closesAt ? durationDeadline : closesAt;
}
