import { describe, expect, it } from "vitest";

import {
  homePathForRole,
  isRoleAllowedOnPath,
} from "@/lib/permissions/routes";
import { USER_ROLES } from "@/types/roles";

describe("homePathForRole", () => {
  it("mỗi role có đúng một khu vực riêng, không trùng nhau", () => {
    const homes = USER_ROLES.map(homePathForRole);
    expect(new Set(homes).size).toBe(USER_ROLES.length);
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
