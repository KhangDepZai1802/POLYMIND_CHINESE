import { z } from "zod";
export const WEEKLY_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
export type WeeklyDay = (typeof WEEKLY_DAYS)[number];
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const slotSchema = z
  .object({ day: z.enum(WEEKLY_DAYS), start_time: clock, end_time: clock })
  .refine((v) => v.end_time > v.start_time, {
    message: "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.",
    path: ["end_time"],
  });
export type WeeklySlot = z.infer<typeof slotSchema>;
const base = {
  class_id: z.uuid(),
  expected_updated_at: z.string().min(1),
  teacher_name: z.string().trim().min(1, "Nhập giáo viên phụ trách.").max(200),
};
const current = z
  .object({
    ...base,
    slots: z.array(slotSchema).min(1, "Chọn ít nhất một thứ học.").max(7),
  })
  .refine((v) => new Set(v.slots.map((s) => s.day)).size === v.slots.length, {
    message: "Mỗi thứ chỉ có một khung giờ.",
    path: ["slots"],
  });
// Existing clients may still send a shared time range during a rolling update.
const legacy = z
  .object({
    ...base,
    weekdays: z.array(z.enum(WEEKLY_DAYS)).min(1).max(7),
    start_time: clock,
    end_time: clock,
  })
  .refine((v) => v.end_time > v.start_time)
  .transform((v) => ({
    ...v,
    slots: WEEKLY_DAYS.filter((day) => v.weekdays.includes(day)).map((day) => ({
      day,
      start_time: v.start_time,
      end_time: v.end_time,
    })),
  }));
export const weeklyScheduleSchema = z.union([current, legacy]);
const timesIn = (text: string) =>
  [...text.matchAll(/(\d{1,2})\s*[:hHgG]\s*(\d{2})/g)].map(
    (m) => `${m[1]!.padStart(2, "0")}:${m[2]}`,
  );
export function readWeeklySlots(
  days: string | null,
  time: string | null,
): WeeklySlot[] {
  const tokens: string[] = (days ?? "").toUpperCase().match(/T[2-7]|CN/g) ?? [];
  const text = time ?? "";
  const tagged = /\b(T[2-7]|CN)\b/i.test(text);
  const common = tagged ? [] : timesIn(text);
  return WEEKLY_DAYS.filter((d) => tokens.includes(d)).map((day) => {
    const segment = tagged
      ? text
          .split(/[;\n]/)
          .find((part) => new RegExp(`\\b${day}\\b`, "i").test(part))
      : undefined;
    const times = segment
      ? timesIn(segment)
      : common.length === 2
        ? common
        : [];
    return { day, start_time: times.length === 2 ? times[0]! : "", end_time: times.length === 2 ? times[1]! : "" };
  });
}
export function serializeWeeklySlots(slots: WeeklySlot[]) {
  const ordered = WEEKLY_DAYS.flatMap((day) =>
    slots.filter((s) => s.day === day),
  );
  const ranges = new Set(ordered.map((s) => `${s.start_time}–${s.end_time}`));
  return ranges.size === 1
    ? [...ranges][0]!
    : ordered.map((s) => `${s.day} ${s.start_time}–${s.end_time}`).join("; ");
}
export function readWeeklyDefaults(days: string | null, time: string | null) {
  const slots = readWeeklySlots(days, time);
  return {
    weekdays: slots.map((s) => s.day),
    start_time: slots[0]?.start_time ?? "",
    end_time: slots[0]?.end_time ?? "",
  };
}
