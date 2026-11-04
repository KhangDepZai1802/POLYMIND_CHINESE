import { describe, expect, it } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";

describe("teacher account creator navigation", () => {
  const links = (allowed: boolean) =>
    getNavigationGroups("teacher", { canCreateTeacherAccounts: allowed })
      .flatMap((group) => group.items)
      .map((item) => item.href);

  it("shows the teacher account page only to an allowed teacher", () => {
    expect(links(true)).toContain("/teacher/teachers");
    expect(links(false)).not.toContain("/teacher/teachers");
  });

  it("labels the class directory as all classes only for an allowed teacher", () => {
    const label = (allowed: boolean) =>
      getNavigationGroups("teacher", { canCreateTeacherAccounts: allowed })
        .flatMap((group) => group.items)
        .find((item) => item.href === "/teacher/classes")?.label;
    expect(label(true)).toBe("Tất cả lớp");
    expect(label(false)).toBe("Lớp của tôi");
  });
});
