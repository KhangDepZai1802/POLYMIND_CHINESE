import { z } from "zod";

/** "HH:mm" — so sánh chuỗi được vì độ dài cố định và có zero-padding. */
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, { message: "Giờ không hợp lệ (HH:mm)" });

const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalUuid = z
  .union([z.literal(""), z.literal("none"), z.uuid()])
  .transform((v) => (v === "" || v === "none" ? null : v))
  .nullable();

/**
 * Một dòng lịch lặp: "Thứ Ba, 18:00–20:00".
 *
 * Lớp KHÔNG có dòng nào là hợp lệ — đó là lớp linh hoạt (LOP-01 học theo lịch
 * Ban Giám đốc VCB). Không được ép mỗi lớp phải có lịch lặp.
 */
export const classScheduleSchema = z
  .object({
    class_id: z.uuid(),
    weekday: z.coerce
      .number()
      .int()
      .min(1, { message: "Chọn thứ" })
      .max(7, { message: "Chọn thứ" }),
    start_time: timeSchema,
    end_time: timeSchema,
    effective_from: optionalDate,
    effective_to: optionalDate,
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["end_time"],
  })
  .refine(
    (d) =>
      !d.effective_from || !d.effective_to || d.effective_to >= d.effective_from,
    { message: "Ngày kết thúc phải sau ngày bắt đầu", path: ["effective_to"] },
  );

/**
 * Buổi học thêm tay — dành cho lớp linh hoạt không có lịch lặp.
 *
 * `starts_at`/`ends_at` là chuỗi từ `<input type="datetime-local">`, tức GIỜ VIỆT
 * NAM. Server đổi sang UTC bằng `fromLocalInput()` trước khi ghi DB. Tuyệt đối
 * không `new Date(chuỗi)` thẳng — nó diễn giải theo múi giờ của máy chạy code,
 * trên Vercel (UTC) sẽ lệch 7 tiếng và chỉ lộ ra sau khi deploy.
 */
export const manualSessionSchema = z
  .object({
    class_id: z.uuid(),
    starts_at: z.string().min(1, { message: "Chọn thời gian bắt đầu" }),
    ends_at: z.string().min(1, { message: "Chọn thời gian kết thúc" }),
    topic: optionalText,
    lesson_id: optionalUuid,
  })
  .refine((d) => d.ends_at > d.starts_at, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["ends_at"],
  });

export type ClassScheduleInput = z.infer<typeof classScheduleSchema>;
export type ManualSessionInput = z.infer<typeof manualSessionSchema>;
