import { describe, expect, it } from "vitest";

import {
  getNavigation,
  isNavItemActive,
} from "@/lib/permissions/navigation";
import { homePathForRole } from "@/lib/permissions/routes";
import { USER_ROLES } from "@/types/roles";

describe("navigation", () => {
  it("mọi link trong menu của một role đều nằm trong khu vực của role đó", () => {
    // Menu không phải phân quyền, nhưng menu trỏ ra ngoài khu vực = link chết
    // (middleware sẽ đá ngược lại) → phải bắt được ngay ở test.
    for (const role of USER_ROLES) {
      const home = homePathForRole(role);
      for (const item of getNavigation(role)) {
        expect(
          item.href === home || item.href.startsWith(`${home}/`),
          `${role}: ${item.href} nằm ngoài ${home}`,
        ).toBe(true);
      }
    }
  });

  it("mỗi role có ít nhất một mục điều hướng", () => {
    for (const role of USER_ROLES) {
      expect(getNavigation(role).length).toBeGreaterThan(0);
    }
  });

  it("không có href trùng nhau trong cùng một menu", () => {
    for (const role of USER_ROLES) {
      const hrefs = getNavigation(role).map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

describe("isNavItemActive", () => {
  const items = getNavigation("super_admin");
  const overview = items.find((i) => i.href === "/admin")!;
  const students = items.find((i) => i.href === "/admin/students")!;

  it("mục gốc chỉ sáng khi khớp CHÍNH XÁC", () => {
    expect(isNavItemActive(overview, "/admin")).toBe(true);
    // Nếu so khớp tiền tố, "Tổng quan" sẽ sáng đèn ở mọi trang admin.
    expect(isNavItemActive(overview, "/admin/students")).toBe(false);
  });

  it("mục con sáng cả ở trang chi tiết bên trong nó", () => {
    expect(isNavItemActive(students, "/admin/students")).toBe(true);
    expect(isNavItemActive(students, "/admin/students/abc-123")).toBe(true);
    expect(isNavItemActive(students, "/admin/classes")).toBe(false);
  });
});
