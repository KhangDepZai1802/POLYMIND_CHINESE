import { z } from "zod";

import { USERNAME_PATTERN } from "@/features/users/account";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, {
    message:
      "Tên đăng nhập gồm 3–32 ký tự thường: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang",
  });

export const adminPasswordSchema = z
  .string()
  .min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự" })
  .max(72, { message: "Mật khẩu không được quá 72 ký tự" });

export const accountCredentialsSchema = z.object({
  username: usernameSchema,
  password: adminPasswordSchema,
});
