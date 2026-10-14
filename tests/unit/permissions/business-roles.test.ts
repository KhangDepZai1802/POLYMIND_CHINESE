import { describe, expect, it } from "vitest";
import { BUSINESS_ROLES, isManagerRole } from "@/types/roles";
import { homePathForRole, isRoleAllowedOnPath } from "@/lib/permissions/routes";
import { getNavigation } from "@/lib/permissions/navigation";
import { notificationPathForRole, safeNotificationLink } from "@/features/notifications/links";
import { adminPasswordSchema } from "@/features/users/schema";

describe("business account isolation", () => {
  it.each(BUSINESS_ROLES)("%s has its own workspace without management privileges", role => {
    expect(homePathForRole(role)).toBe("/workspace");
    expect(isRoleAllowedOnPath(role, "/workspace")).toBe(true);
    expect(isRoleAllowedOnPath(role, "/workspace/notifications")).toBe(true);
    expect(notificationPathForRole(role)).toBe("/workspace/notifications");
    expect(safeNotificationLink("/admin/system", role)).toBeNull();
    expect(isManagerRole(role)).toBe(false);
    for (const path of ["/admin", "/admin/system", "/admin/b2c/tuition", "/teacher", "/student", "/workspaces"]) {
      expect(isRoleAllowedOnPath(role, path)).toBe(false);
    }
    for (const item of getNavigation(role)) expect(isRoleAllowedOnPath(role, item.href)).toBe(true);
  });
  it("keeps the general password policy at eight characters", () => {
    expect(adminPasswordSchema.safeParse("abcdef").success).toBe(false);
    expect(adminPasswordSchema.safeParse("abcdefgh").success).toBe(true);
  });
});
