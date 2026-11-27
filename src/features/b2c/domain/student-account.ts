import { z } from "zod";
import { adminPasswordSchema, usernameSchema } from "@/features/users/schema";

export type B2CStudentLogin = {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string;
};

export type B2CStudentAccount = {
  student_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  account: B2CStudentLogin | null;
};

export const b2cStudentAccountSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    student_id: z.uuid(),
    username: usernameSchema,
    password: adminPasswordSchema.refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Mật khẩu không được quá 72 byte.",
    ),
  }),
  z.object({
    mode: z.literal("link"),
    student_id: z.uuid(),
    user_id: z.uuid(),
  }),
]);
