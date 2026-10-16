import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  permissions: vi.fn(),
  today: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireTeaching: mocks.actor }));
vi.mock("@/features/b2c/server/permission-actions", () => ({
  getMyB2CPermissionsAction: mocks.permissions,
}));
vi.mock("@/features/b2c/server/teacher-class-queries", () => ({
  getMyB2CToday: mocks.today,
}));
import { getB2CAttendanceOptions } from "@/features/b2c/server/attendance-options";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ role: "teacher" });
  mocks.permissions.mockResolvedValue(["mark_attendance"]);
  mocks.today.mockResolvedValue({
    rows: [
      { id: "today", status: "planned" },
      { id: "cancelled", status: "cancelled" },
    ],
    override_class_ids: [],
  });
});
it("requires teaching authentication before any read", async () => {
  mocks.actor.mockRejectedValue(new Error("denied"));
  await expect(getB2CAttendanceOptions()).rejects.toThrow("denied");
  expect(mocks.permissions).not.toHaveBeenCalled();
});
it("does not query B2C teacher permissions for an admin without a teaching role", async () => {
  mocks.actor.mockResolvedValue({ role: "super_admin" });
  expect(await getB2CAttendanceOptions()).toBeNull();
  expect(mocks.permissions).not.toHaveBeenCalled();
});
it("does not read meetings when mark_attendance is not granted", async () => {
  mocks.permissions.mockResolvedValue(["view_classes"]);
  expect(await getB2CAttendanceOptions()).toEqual({
    allowed: false,
    meetings: [],
  });
  expect(mocks.today).not.toHaveBeenCalled();
});
it("uses the assigned teacher RPC and excludes cancelled meetings", async () => {
  expect(await getB2CAttendanceOptions()).toEqual({
    allowed: true,
    meetings: [{ id: "today", status: "planned" }],
  });
  expect(mocks.today).toHaveBeenCalledOnce();
});
