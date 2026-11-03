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
});
