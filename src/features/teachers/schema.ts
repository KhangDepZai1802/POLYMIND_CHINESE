import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const teacherSchema = z.object({
  email: z.email({ message: "Email không hợp lệ" }),
  full_name: z.string().trim().min(2, { message: "Nhập họ tên giáo viên" }),
  teacher_code: z
    .string()
    .trim()
    .min(2, { message: "Nhập mã giáo viên" })
    .max(20)
    .regex(/^[A-Z0-9-]+$/, { message: "Mã chỉ gồm chữ IN HOA, số và gạch ngang" }),
  phone: optionalText,
  specialization: optionalText,
  bio: optionalText,
});

export const teacherUpdateSchema = teacherSchema.omit({ email: true }).extend({
  id: z.uuid(),
});

export type TeacherInput = z.infer<typeof teacherSchema>;
