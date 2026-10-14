import { z } from "zod";
export const WEEKDAYS = [
  [1, "T2"],
  [2, "T3"],
  [3, "T4"],
  [4, "T5"],
  [5, "T6"],
  [6, "T7"],
  [7, "CN"],
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z
  .object({
    class_id: z.uuid(),
    request_id: z.uuid(),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .transform((v) => [...new Set(v)].sort()),
    start_time: time,
    end_time: time,
    room_name: z.string().trim().max(120).default(""),
    date_from: z.iso.date().refine((v) => v >= "1900-01-01"),
    date_to: z.iso.date(),
  })
  .superRefine((v, c) => {
    const minutes = (s: string) =>
      Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    if (
      v.end_time <= v.start_time ||
      minutes(v.end_time) - minutes(v.start_time) > 720
    )
      c.addIssue({
        code: "custom",
        message: "Giờ kết thúc sau bắt đầu, cùng ngày và tối đa 12 giờ.",
      });
    const days = (Date.parse(v.date_to) - Date.parse(v.date_from)) / 86400000;
    if (days < 0 || days > 365)
      c.addIssue({
        code: "custom",
        message: "Khoảng ngày tối đa 366 ngày, kết thúc không trước bắt đầu.",
      });
  });
export function countPlannedMeetings(
  days: readonly number[],
  from: string,
  to: string,
) {
  const a = Date.parse(from),
    b = Date.parse(to);
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b < a ||
    b - a > 365 * 86400000
  )
    return 0;
  let count = 0;
  for (let t = a; t <= b; t += 86400000) {
    const d = new Date(t).getUTCDay() || 7;
    if (days.includes(d)) count++;
  }
  return count;
}
export type StructuredSchedule = {
  id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  room_name: string;
  date_from: string;
  date_to: string;
};
