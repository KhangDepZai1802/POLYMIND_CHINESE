import { describe, expect, it } from "vitest";

import {
  accountCredentialsUpdateSchema,
  accountToggleSchema,
} from "@/features/accounts/schema";

describe("quản lý tài khoản — schema", () => {
  it("chấp nhận đổi đăng nhập hợp lệ và chuẩn hóa username", () => {
    const parsed = accountCredentialsUpdateSchema.safeParse({
      user_id: "3f1e8c7a-2b4d-4e6f-8a1b-9c0d1e2f3a4b",
      username: "  GV.Khang_01 ",
      password: "matkhau123",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.username).toBe("gv.khang_01");
  });

  it("từ chối mật khẩu ngắn hơn 8 ký tự", () => {
    const parsed = accountCredentialsUpdateSchema.safeParse({
      user_id: "3f1e8c7a-2b4d-4e6f-8a1b-9c0d1e2f3a4b",
      username: "gv.khang",
      password: "1234567",
    });
    expect(parsed.success).toBe(false);
  });

  it("từ chối user_id không phải UUID", () => {
    const parsed = accountCredentialsUpdateSchema.safeParse({
      user_id: "khong-phai-uuid",
      username: "gv.khang",
      password: "matkhau123",
    });
    expect(parsed.success).toBe(false);
  });

  it("chuyển cờ activate 'true'/'false' thành boolean", () => {
    const on = accountToggleSchema.safeParse({
      user_id: "3f1e8c7a-2b4d-4e6f-8a1b-9c0d1e2f3a4b",
      activate: "true",
    });
    const off = accountToggleSchema.safeParse({
      user_id: "3f1e8c7a-2b4d-4e6f-8a1b-9c0d1e2f3a4b",
      activate: "false",
    });
    expect(on.success && on.data.activate).toBe(true);
    expect(off.success && off.data.activate).toBe(false);
  });
});
