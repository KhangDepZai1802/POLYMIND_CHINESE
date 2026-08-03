import { describe, expect, it } from "vitest";

import {
  getNavigation,
  getNavigationGroups,
  isNavItemActive,
} from "@/lib/permissions/navigation";
import { homePathForRole, isRoleAllowedOnPath } from "@/lib/permissions/routes";
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

describe("menu 2 nhánh của giáo vụ", () => {
  it("chưa được phân lớp ⇒ CHỈ có nhánh Quản lý", () => {
    const groups = getNavigationGroups("academic_manager");
    expect(groups.map((g) => g.label)).toEqual(["Quản lý"]);
  });

  it("được phân lớp ⇒ mới hiện thêm nhánh Lớp được phân công", () => {
    const groups = getNavigationGroups("academic_manager", {
      hasAssignedClasses: true,
    });
    expect(groups.map((g) => g.label)).toEqual([
      "Quản lý",
      "Lớp được phân công",
    ]);
  });

  it("nhánh Quản lý có ĐÚNG 9 mục user chốt", () => {
    // Ghim cả danh sách chứ không chỉ đếm: đếm bằng 9 thì thay Báo cáo bằng
    // Flashcard vẫn xanh, mà đó lại đúng thứ user loại ra.
    expect(getNavigation("academic_manager").map((i) => i.href)).toEqual([
      "/admin",
      "/admin/students",
      "/admin/teachers",
      "/admin/courses",
      "/admin/classes",
      "/admin/schedule",
      "/admin/tuition",
      "/admin/reports",
      "/admin/notifications",
    ]);
  });

  it("KHÔNG có Flashcard, Duyệt câu hỏi, Quản trị & Audit", () => {
    const hrefs = getNavigationGroups("academic_manager", {
      hasAssignedClasses: true,
    }).flatMap((g) => g.items.map((i) => i.href));

    expect(hrefs).not.toContain("/admin/flashcards");
    expect(hrefs).not.toContain("/admin/question-bank-review");
    expect(hrefs).not.toContain("/admin/system");
  });

  it("mọi mục trong CẢ HAI nhánh đều là path giáo vụ thật sự vào được", () => {
    // Đây là chỗ hai file dễ trôi khỏi nhau nhất: `navigation.ts` thêm một mục
    // mà `routes.ts` quên mở (hoặc đang chặn) ⇒ menu có link chết.
    for (const group of getNavigationGroups("academic_manager", {
      hasAssignedClasses: true,
    })) {
      for (const item of group.items) {
        expect(
          isRoleAllowedOnPath("academic_manager", item.href),
          `giáo vụ không vào được ${item.href} nhưng menu vẫn hiện`,
        ).toBe(true);
      }
    }
  });

  it("ba role cũ vẫn là MỘT nhánh không tiêu đề — giao diện không đổi", () => {
    for (const role of ["super_admin", "teacher", "student"] as const) {
      const groups = getNavigationGroups(role, { hasAssignedClasses: true });
      expect(groups).toHaveLength(1);
      expect(groups[0]?.label).toBeNull();
      expect(groups[0]?.items).toEqual(getNavigation(role));
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
