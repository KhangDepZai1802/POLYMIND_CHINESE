import { z } from "zod";
import { adminPasswordSchema } from "@/features/users/schema";

export const teacherAccountTargetSchema = z.object({
  kind: z.enum(["teacher", "b2c"]),
  id: z.uuid(),
});
export type TeacherAccountTarget = z.infer<typeof teacherAccountTargetSchema>;
export const teacherPasswordChangeSchema = teacherAccountTargetSchema
  .extend({
    expected_user_id: z.uuid(),
    password: adminPasswordSchema,
    confirm_password: adminPasswordSchema,
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Mật khẩu xác nhận chưa khớp.",
  });
export type TeacherAccountDetails = {
  teacher_id: string;
  user_id: string;
  full_name: string;
  login: string;
  username: string | null;
  role: "teacher" | "academic_manager";
  account_active: boolean;
  teacher_active: boolean;
};
