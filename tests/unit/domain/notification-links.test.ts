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

  // `GIAOVU-NOTIFY-004` (Codex 2026-08-03): bản cũ dựng đường bằng `/${role}`
  // nên giáo vụ nhận `/academic_manager/notifications` — route không tồn tại,
  // bấm chuông ra 404.
  it("giáo vụ về /admin/notifications, KHÔNG phải /academic_manager/...", () => {
    expect(notificationPathForRole("academic_manager")).toBe(
      "/admin/notifications",
    );
  });

  it("giáo vụ nhận deep-link ở CẢ HAI cây vì họ vào được cả hai", () => {
    expect(safeNotificationLink("/admin/tuition", "academic_manager")).toBe(
      "/admin/tuition",
    );
    expect(
      safeNotificationLink("/teacher/sessions/abc", "academic_manager"),
    ).toBe("/teacher/sessions/abc");
  });

  it("giáo vụ vẫn bị loại link sang khu học viên", () => {
    expect(
      safeNotificationLink("/student/results", "academic_manager"),
    ).toBeNull();
    expect(
      safeNotificationLink("//evil.test", "academic_manager"),
    ).toBeNull();
  });

  it("loại URL ngoài hệ thống và protocol-relative", () => {
    expect(safeNotificationLink("https://evil.test", "student")).toBeNull();
    expect(safeNotificationLink("//evil.test", "student")).toBeNull();
    expect(safeNotificationLink("javascript:alert(1)", "student")).toBeNull();
    expect(safeNotificationLink(null, "student")).toBeNull();
  });
});
