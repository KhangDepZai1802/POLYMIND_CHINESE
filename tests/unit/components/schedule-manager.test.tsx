import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/schedules/server/actions", () => ({
  cancelSessionAction: vi.fn(),
  createManualSessionAction: vi.fn(),
  createScheduleAction: vi.fn(),
  deleteAllSessionsAction: vi.fn(),
  deleteScheduleAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  generateSessionsAction: vi.fn(),
}));

import { ScheduleManager } from "@/features/schedules/components/schedule-manager";

const SESSIONS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    session_number: 1,
    starts_at: "2099-07-20T01:00:00.000Z",
    ends_at: "2099-07-20T02:30:00.000Z",
    status: "scheduled" as const,
    topic: "Chào hỏi cơ bản",
    lesson: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    session_number: 2,
    starts_at: "2099-07-22T01:00:00.000Z",
    ends_at: "2099-07-22T02:30:00.000Z",
    status: "scheduled" as const,
    topic: "Giới thiệu bản thân",
    lesson: null,
  },
];

describe("ScheduleManager — chuyển kiểu thời khóa biểu", () => {
  it("mặc định hiện tuần và chuyển được qua tối giản/tháng", async () => {
    const user = userEvent.setup();

    render(
      <ScheduleManager
        classId="33333333-3333-4333-8333-333333333333"
        plannedSessionCount={35}
        hasStartDate
        schedules={[]}
        sessions={SESSIONS}
        lessons={[]}
      />,
    );

    const weekButton = screen.getByRole("button", { name: "Tuần" });
    expect(weekButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("20/07 – 26/07/2099")).toBeInTheDocument();
    expect(screen.getByText("Chào hỏi cơ bản")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tối giản" }));
    expect(screen.getByRole("button", { name: "Tối giản" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("20/07/2099 08:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tháng" }));
    expect(screen.getByText("Tháng 7 năm 2099")).toBeInTheDocument();
    expect(screen.getByTitle("Buổi 1 · Đã lên lịch")).toBeInTheDocument();
  });
});
