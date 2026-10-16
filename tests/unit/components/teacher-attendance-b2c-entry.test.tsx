import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  b2c: vi.fn(),
  today: vi.fn(),
  pending: vi.fn(),
  actor: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireTeaching: mocks.actor }));
vi.mock("@/features/attendance/server/queries", () => ({
  getAttendanceSheet: vi.fn(),
}));
vi.mock("@/features/attendance/components/attendance-roster", () => ({
  AttendanceRoster: () => null,
}));
vi.mock("@/features/dashboard/server/teacher-queries", () => ({
  getTeacherSessionsToday: mocks.today,
  getSessionsNeedingAttendance: mocks.pending,
}));
vi.mock("@/features/b2c/server/attendance-options", () => ({
  getB2CAttendanceOptions: mocks.b2c,
}));
import TeacherAttendancePage from "@/app/(dashboard)/teacher/attendance/page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ role: "teacher" });
  mocks.today.mockResolvedValue([]);
  mocks.pending.mockResolvedValue([]);
  mocks.b2c.mockResolvedValue({
    allowed: true,
    meetings: [
      {
        id: "meeting-a",
        class_id: "class-a",
        code: "B2C-000002",
        name: "Pre-Movers",
        starts_at: "2026-10-16T10:30:00Z",
        ends_at: "2026-10-16T12:30:00Z",
        status: "planned",
        room_name: "",
      },
    ],
  });
});
afterEach(cleanup);
it("shows the B2C meeting in the attendance menu even when no enterprise sessions exist", async () => {
  render(await TeacherAttendancePage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("B2C-000002 · Pre-Movers")).toBeInTheDocument();
  expect(screen.getByText(/17:30–19:30/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Điểm danh học viên" }),
  ).toHaveAttribute(
    "href",
    "/teacher/b2c-classes/class-a?tab=attendance&meeting=meeting-a",
  );
});
it("preserves the enterprise session link alongside the B2C entry", async () => {
  mocks.today.mockResolvedValue([
    {
      id: "enterprise-a",
      classCode: "DN01",
      sessionNumber: 2,
      startsAt: "2026-10-16T01:00:00Z",
      endsAt: "2026-10-16T02:00:00Z",
      marked: 0,
      expected: 1,
      isFullyMarked: false,
    },
  ]);
  render(await TeacherAttendancePage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("link", { name: /DN01/ })).toHaveAttribute(
    "href",
    "/teacher/attendance?session=enterprise-a",
  );
  expect(
    screen.getByRole("link", { name: "Điểm danh học viên" }),
  ).toBeInTheDocument();
});
