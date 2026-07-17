import { z } from "zod";

import { adminPasswordSchema, usernameSchema } from "@/features/users/schema";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const teacherSchema = z.object({
  username: usernameSchema,
  password: adminPasswordSchema,
  email: z
    .union([z.literal(""), z.email({ message: "Email liên hệ không hợp lệ" })])
    .transform((value) => value || null),
  full_name: z.string().trim().min(2, { message: "Nhập họ tên giáo viên" }),
  phone: optionalText,
  specialization: optionalText,
  bio: optionalText,
});

export const teacherUpdateSchema = teacherSchema
  .omit({ email: true, username: true, password: true })
  .extend({ id: z.uuid() });

export const teacherCredentialsSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  password: adminPasswordSchema,
});

export type TeacherInput = z.infer<typeof teacherSchema>;
