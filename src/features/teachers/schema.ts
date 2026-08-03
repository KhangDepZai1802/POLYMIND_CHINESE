import { z } from "zod";

import { adminPasswordSchema, usernameSchema } from "@/features/users/schema";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

/**
 * Vai trò của người được tạo ở màn Giáo viên.
 *
 * Giáo vụ tạo TẠI ĐÂY chứ không ở một màn riêng — đó là cách rẻ nhất để bảo đảm
 * điểm (2) của `D-2`: mọi giáo vụ đều có hàng `teachers` ngay từ lúc tạo, nên tự
 * phân công chính mình vào lớp được mà không phải nhờ super admin. Tách ra màn
 * riêng là mở đường cho hồ sơ giáo vụ không có hàng `teachers` — hỏng lặng lẽ,
 * chỉ lộ ra khi họ mở màn phân công và không thấy tên mình.
 *
 * ⛔ KHÔNG thêm `super_admin` vào đây. Nâng ai đó lên quản trị là việc của trang
 * Quản trị, không phải của form nhập hồ sơ giảng dạy.
 */
export const teacherAccountRoleSchema = z
  .enum(["teacher", "academic_manager"])
  .default("teacher");

export const teacherSchema = z.object({
  username: usernameSchema,
  password: adminPasswordSchema,
  account_role: teacherAccountRoleSchema,
  email: z
    .union([z.literal(""), z.email({ message: "Email liên hệ không hợp lệ" })])
    .transform((value) => value || null),
  full_name: z.string().trim().min(2, { message: "Nhập họ tên giáo viên" }),
  phone: optionalText,
  specialization: optionalText,
  bio: optionalText,
});

// `account_role` bị loại khỏi form SỬA: đổi vai trò là thao tác trên tài khoản,
// và `trg_profiles_no_self_escalation` chặn nó ở DB cho mọi client trừ
// service_role. Để nó trong form sửa là hứa một việc mà tầng dưới từ chối.
export const teacherUpdateSchema = teacherSchema
  .omit({ email: true, username: true, password: true, account_role: true })
  .extend({ id: z.uuid() });

export const teacherCredentialsSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  password: adminPasswordSchema,
});

export type TeacherInput = z.infer<typeof teacherSchema>;
