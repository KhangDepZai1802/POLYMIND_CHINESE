import { describe, expect, it } from "vitest";

import {
  notificationPathForRole,
  safeNotificationLink,
} from "@/features/notifications/links";

describe("notification links", () => {
  it("trả đúng notification center theo role", () => {
    expect(notificationPathForRole("super_admin")).toBe("/admin/notifications");
    expect(notificationPathForRole("teacher")).toBe("/teacher/notifications");
    expect(notificationPathForRole("student")).toBe("/student/notifications");
  });

  it("chỉ nhận route nội bộ trong đúng khu vực role", () => {
    expect(safeNotificationLink("/student/results", "student")).toBe(
      "/student/results",
    );
    expect(safeNotificationLink("/student", "student")).toBe("/student");
    expect(safeNotificationLink("/teacher/classes/abc", "teacher")).toBe(
      "/teacher/classes/abc",
    );
  });

  it("loại link sang khu vực role khác", () => {
    expect(safeNotificationLink("/admin/tuition", "student")).toBeNull();
    expect(safeNotificationLink("/student/results", "teacher")).toBeNull();
  });

  it("loại URL ngoài hệ thống và protocol-relative", () => {
    expect(safeNotificationLink("https://evil.test", "student")).toBeNull();
    expect(safeNotificationLink("//evil.test", "student")).toBeNull();
    expect(safeNotificationLink("javascript:alert(1)", "student")).toBeNull();
    expect(safeNotificationLink(null, "student")).toBeNull();
  });
});
