import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";

type WeeklyClass = {
  status: string;
  start_date: string | null;
  weekdays_text: string | null;
};

/** A weekly plan is display-only; it never creates attendance/payroll sessions. */
export function getB2CClassesToday<T extends WeeklyClass>(
  classes: readonly T[],
  now: Date,
): T[] {
  const date = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
  const weekday = Number(formatInTimeZone(now, APP_TIMEZONE, "i"));
  const dayToken = weekday === 7 ? "CN" : `T${weekday + 1}`;
  return classes.filter((item) => {
    if (item.status !== "active" || (item.start_date && item.start_date > date))
      return false;
    const days: string[] =
      (item.weekdays_text ?? "").toUpperCase().match(/\b(?:T[2-7]|CN)\b/g) ??
      [];
    return days.includes(dayToken);
  });
}
