import { z } from "zod";
export const teachingSessionSchema = z
  .object({
    class_id: z.uuid(),
    teacher_id: z.uuid(),
    date: z.iso.date(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .superRefine((v, ctx) => {
    const start = new Date(`${v.date}T${v.start_time}:00+07:00`).getTime();
    const end = new Date(`${v.date}T${v.end_time}:00+07:00`).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 12 * 3600000
    )
      ctx.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "Giờ kết thúc phải sau giờ bắt đầu, tối đa 12 giờ/buổi.",
      });
  });
export const checkpointSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["in", "out"]),
  photo: z.string().min(1).max(500),
});
export type TeachingRow = {
  id: string;
  class_name: string;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
  hourly_rate: number | null;
  teaching_hours: number;
  salary: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
};
export type TeachingPage = {
  pending_price_count?: number;
  rows: TeachingRow[];
  total: number;
  hours: number;
  salary: number;
};
