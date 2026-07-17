import { describe, expect, it } from "vitest";

import {
  loginIdentifierToEmail,
  normalizeUsername,
  usernameToLoginEmail,
} from "@/features/users/account";

describe("tài khoản nội bộ", () => {
  it("chuẩn hóa username và tạo email kỹ thuật xác định", () => {
    expect(normalizeUsername("  GV.An_01 ")).toBe("gv.an_01");
    expect(usernameToLoginEmail("GV.An_01")).toBe(
      "gv.an_01@login.polymind.local",
    );
  });

  it("giữ email cũ để tài khoản hiện hữu vẫn đăng nhập được", () => {
    expect(loginIdentifierToEmail("gv.a@polymind.test")).toBe(
      "gv.a@polymind.test",
    );
    expect(loginIdentifierToEmail("gv.a")).toBe("gv.a@login.polymind.local");
  });
});
