import { z } from "zod";

export const sessionLogSchema = z.object({
  session_id: z.uuid("Buổi học không hợp lệ."),
  lesson_id: z.uuid("Vui lòng chọn bài học đã dạy."),
  lesson_log: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nội dung thực dạy.")
    .max(5000, "Nội dung thực dạy không được vượt quá 5000 ký tự."),
  teacher_note: z
    .string()
    .trim()
    .max(2000, "Ghi chú không được vượt quá 2000 ký tự."),
  intent: z.enum(["draft", "complete"]),
});

export type SessionLogInput = z.infer<typeof sessionLogSchema>;
