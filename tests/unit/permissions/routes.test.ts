import { describe, expect, it } from "vitest";

import {
  homePathForRole,
  isRoleAllowedOnPath,
} from "@/lib/permissions/routes";
import { USER_ROLES } from "@/types/roles";

describe("homePathForRole", () => {
  // ⚠️ Bài cũ ghim "mỗi role có đúng một khu vực riêng, không trùng nhau".
  // `D-2` (user chốt 2026-08-03) ĐẢO luật đó: giáo vụ dùng lại `/admin` và
  // `/teacher` thay vì có cây `/staff/*` riêng. Bài mới ghim đúng luật mới —
  // không xoá bài, vì mất bài này là mất cả chỗ canh "role mới quên khai home".
  it("mọi role đều có trang chủ, và đó phải là một trong ba cây có thật", () => {
    for (const role of USER_ROLES) {
      expect(["/admin", "/teacher", "/student"]).toContain(
        homePathForRole(role),
      );
    }
  });

  it("giáo vụ về /admin — nhánh Quản lý là việc chính hằng ngày", () => {
    expect(homePathForRole("academic_manager")).toBe("/admin");
  });
});

describe("isRoleAllowedOnPath", () => {
  it("cho phép role vào đúng khu vực của mình", () => {
    expect(isRoleAllowedOnPath("super_admin", "/admin")).toBe(true);
    expect(isRoleAllowedOnPath("super_admin", "/admin/students")).toBe(true);
    expect(isRoleAllowedOnPath("teacher", "/teacher/attendance")).toBe(true);
    expect(isRoleAllowedOnPath("student", "/student/results")).toBe(true);
  });

  it("chặn role đi lạc sang khu vực của role khác", () => {
    expect(isRoleAllowedOnPath("teacher", "/admin")).toBe(false);
    expect(isRoleAllowedOnPath("teacher", "/admin/tuition")).toBe(false);
    expect(isRoleAllowedOnPath("student", "/teacher/classes")).toBe(false);
    expect(isRoleAllowedOnPath("student", "/admin/system")).toBe(false);
    expect(isRoleAllowedOnPath("super_admin", "/teacher")).toBe(false);
  });

  it("giáo vụ đi được CẢ HAI cây — đây là điểm khác biệt của role này", () => {
    expect(isRoleAllowedOnPath("academic_manager", "/admin")).toBe(true);
    expect(isRoleAllowedOnPath("academic_manager", "/admin/students")).toBe(true);
    expect(isRoleAllowedOnPath("academic_manager", "/admin/tuition")).toBe(true);
    expect(isRoleAllowedOnPath("academic_manager", "/teacher")).toBe(true);
    expect(isRoleAllowedOnPath("academic_manager", "/teacher/attendance")).toBe(
      true,
    );
  });

  it("giáo vụ vẫn bị chặn ở ĐÚNG BA trang quản trị, dù chúng nằm trong /admin", () => {
    // Vế này là toàn bộ lý do phải có danh sách chặn: prefix `/admin` khớp,
    // nên nếu chỉ xét prefix thì ba trang dưới đây lọt hết.
    expect(isRoleAllowedOnPath("academic_manager", "/admin/system")).toBe(false);
    expect(isRoleAllowedOnPath("academic_manager", "/admin/flashcards")).toBe(
      false,
    );
    expect(
      isRoleAllowedOnPath("academic_manager", "/admin/question-bank-review"),
    ).toBe(false);
  });

  it("danh sách chặn phủ cả trang con, không chỉ trang gốc", () => {
    expect(
      isRoleAllowedOnPath("academic_manager", "/admin/flashcards/abc-123"),
    ).toBe(false);
    expect(isRoleAllowedOnPath("academic_manager", "/admin/system/audit")).toBe(
      false,
    );
  });

  it("giáo vụ KHÔNG vào được khu học viên", () => {
    expect(isRoleAllowedOnPath("academic_manager", "/student")).toBe(false);
    expect(isRoleAllowedOnPath("academic_manager", "/student/tuition")).toBe(
      false,
    );
  });

  it("FAIL-CLOSED: path lạ không thuộc khu vực nào → từ chối mọi role", () => {
    // Đây là bài học từ CR-M14-3 ở hệ cũ: hàm phân quyền có nhánh
    // `return true` mặc định → mọi thứ không khớp rule đều được cho qua.
    for (const role of USER_ROLES) {
      expect(isRoleAllowedOnPath(role, "/internal/debug")).toBe(false);
      expect(isRoleAllowedOnPath(role, "/")).toBe(false);
      expect(isRoleAllowedOnPath(role, "")).toBe(false);
    }
  });

  it("không bị lừa bởi path chỉ TRÙNG TIỀN TỐ chuỗi", () => {
    // "/admin-secret" bắt đầu bằng "/admin" nếu so sánh chuỗi ngây thơ,
    // nhưng nó KHÔNG nằm trong khu vực /admin.
    expect(isRoleAllowedOnPath("super_admin", "/admin-secret")).toBe(false);
    expect(isRoleAllowedOnPath("teacher", "/teacherx")).toBe(false);
    expect(isRoleAllowedOnPath("student", "/students")).toBe(false);
  });
});
