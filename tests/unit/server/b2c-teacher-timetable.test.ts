import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getTeacherTimetable } from "@/features/b2c/server/teacher-timetable";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.manager.mockResolvedValue({ role: "academic_manager" });
  mocks.client.mockResolvedValue({ from: mocks.from });
});
it("rejects unauthorized users before reading teacher or class data", async () => {
  mocks.manager.mockRejectedValue(new Error("denied"));
  await expect(getTeacherTimetable()).rejects.toThrow("denied");
  expect(mocks.client).not.toHaveBeenCalled();
});
it("reads only B2C tables and does not turn errors into empty schedules", async () => {
  mocks.from.mockImplementation(() => {
    const q = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "offline" } }),
    };
    for (const fn of [q.select, q.in, q.order]) fn.mockReturnValue(q);
    return q;
  });
  await expect(getTeacherTimetable()).rejects.toThrow(
    "Không tải được thời khóa biểu",
  );
  expect(mocks.from.mock.calls.map(([table]) => table).sort()).toEqual([
    "b2c_classes",
    "b2c_teachers",
  ]);
});
