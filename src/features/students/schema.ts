import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" || v === "none" ? null : v))
  .nullable();

const optionalEmail = z
  .union([z.literal(""), z.email({ message: "Email không hợp lệ" })])
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const studentSchema = z.object({
  student_code: z
    .string()
    .trim()
    .min(2, { message: "Nhập mã học viên" })
    .max(20)
    .regex(/^[A-Z0-9-]+$/, { message: "Mã chỉ gồm chữ IN HOA, số và gạch ngang" }),
  full_name: z.string().trim().min(2, { message: "Nhập họ tên học viên" }),
  dob: optionalDate,
  gender: optionalText,
  phone: optionalText,
  email: optionalEmail,
  address: optionalText,

  // Người giám hộ CHỈ là thông tin liên hệ — KHÔNG phải tài khoản đăng nhập.
  // Hệ cũ biến phụ huynh thành một role thật và kéo theo cả ma trận phân quyền.
  guardian_name: optionalText,
  guardian_phone: optionalText,
  guardian_relation: optionalText,

  current_level_id: optionalUuid,
  target_level_id: optionalUuid,
  learning_goal: optionalText,
  note: optionalText,
});

export const studentUpdateSchema = studentSchema.extend({ id: z.uuid() });

export const inviteStudentSchema = z.object({
  id: z.uuid(),
  email: z.email({ message: "Email không hợp lệ" }),
});

export type StudentInput = z.infer<typeof studentSchema>;
