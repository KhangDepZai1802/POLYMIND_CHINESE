import { describe, expect, it } from "vitest";

import {
  INTERNAL_LOGIN_DOMAIN as SCRIPT_DOMAIN,
  USERNAME_PATTERN as SCRIPT_PATTERN,
  asciiSlug,
  buildStudentUsername,
  usernameToLoginEmail as scriptLoginEmail,
} from "../../scripts/lib/student-username.mjs";
import {
  USERNAME_PATTERN,
  usernameToLoginEmail,
} from "@/features/users/account";

/**
 * Công thức `đệm+tên.họ` sống ở `scripts/lib/student-username.mjs` vì script dữ
 * liệu chạy bằng `node` trần, không qua bundler — nó không import được file .ts.
 * Hai bài đầu ở đây là chốt chặn giữ cho bản sao đó không âm thầm lệch khỏi
 * `src/features/users/account.ts` thành nguồn sự thật thứ hai.
 */
describe("bản sao trong scripts phải khớp app", () => {
  it("dùng chung đúng một định dạng tên đăng nhập", () => {
    expect(SCRIPT_PATTERN.source).toBe(USERNAME_PATTERN.source);
    expect(SCRIPT_PATTERN.flags).toBe(USERNAME_PATTERN.flags);
  });

  it("dựng cùng một địa chỉ đăng nhập nội bộ", () => {
    expect(SCRIPT_DOMAIN).toBe("login.polymind.local");
    expect(scriptLoginEmail("vannga.nguyen")).toBe(
      usernameToLoginEmail("vannga.nguyen"),
    );
  });
});

describe("buildStudentUsername — đệm+tên.họ, bỏ dấu", () => {
  it("ghép cả phần đệm vào trước dấu chấm", () => {
    // Ví dụ user chốt 2026-08-03.
    expect(buildStudentUsername("Nguyễn Văn Ngà")).toEqual({
      ok: true,
      username: "vannga.nguyen",
    });
    expect(buildStudentUsername("Phạm Nguyễn Cao Sơn")).toEqual({
      ok: true,
      username: "nguyencaoson.pham",
    });
  });

  it("tách được đúng hai cái tên chỉ khác nhau ở dấu thanh", () => {
    // Lý do công thức là `đệm+tên` chứ không phải `tên`: bỏ dấu xong `Nga` và
    // `Ngà` bằng nhau, `tên.họ` sẽ cấp một tài khoản cho hai người.
    const a = buildStudentUsername("Nguyễn Hữu Ngọc Nga");
    const b = buildStudentUsername("Nguyễn Văn Ngà");
    expect(a).toEqual({ ok: true, username: "huungocnga.nguyen" });
    expect(b).toEqual({ ok: true, username: "vannga.nguyen" });
    expect(a).not.toEqual(b);
  });

  it("xử lý đ/Đ — NFD không tách được ký tự này", () => {
    expect(asciiSlug("Đặng")).toBe("dang");
    expect(buildStudentUsername("Đào Xuân Kiêm")).toEqual({
      ok: true,
      username: "xuankiem.dao",
    });
  });

  it("chịu được khoảng trắng thừa", () => {
    expect(buildStudentUsername("  Lý   Minh  Trung ")).toEqual({
      ok: true,
      username: "minhtrung.ly",
    });
  });

  it("từ chối thay vì đoán khi không tách được họ và tên", () => {
    expect(buildStudentUsername("Trần").ok).toBe(false);
    expect(buildStudentUsername("   ").ok).toBe(false);
    expect(buildStudentUsername("陈 志强").ok).toBe(false);
  });

  it("từ chối khi vượt trần 32 ký tự của định dạng", () => {
    const long = buildStudentUsername(
      "Nguyễn Hoàng Bích Phương Thanh Tuyền Diễm",
    );
    expect(long.ok).toBe(false);
  });

  it("mọi tên đăng nhập sinh ra đều khớp định dạng của app", () => {
    for (const name of [
      "Trần Thị Bích Liên",
      "Nguyễn Hoàng Bích Phương",
      "Võ Thập Tử Long",
      "Trịnh Kim Trung Hiếu",
      "Hồ Thị Thảo",
    ]) {
      const built = buildStudentUsername(name);
      expect(built.ok).toBe(true);
      // `?? ""` chứ không phải `!`: chuỗi rỗng KHÔNG khớp `USERNAME_PATTERN`,
      // nên nếu `username` lỡ vắng mặt thì bài này vẫn đỏ chứ không xanh giả.
      expect(USERNAME_PATTERN.test(built.username ?? "")).toBe(true);
    }
  });
});
