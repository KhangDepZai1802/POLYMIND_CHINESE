import { z } from "zod";

import { adminPasswordSchema, usernameSchema } from "@/features/users/schema";

/** Đổi tên đăng nhập + đặt lại mật khẩu cho MỘT tài khoản bất kỳ (mọi role). */
export const accountCredentialsUpdateSchema = z.object({
  user_id: z.uuid(),
  username: usernameSchema,
  password: adminPasswordSchema,
});

export const accountToggleSchema = z.object({
  user_id: z.uuid(),
  activate: z.enum(["true", "false"]).transform((v) => v === "true"),
});
