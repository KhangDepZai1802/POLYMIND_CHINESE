import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeacherHomeDashboard } from "@/features/dashboard/components/teacher-home-dashboard";
import type { ComponentProps } from "react";
const props: ComponentProps<typeof TeacherHomeDashboard> = {
  fullName: "Cô Lê",
  now: "2026-10-14T05:00:00Z",
  today: [],
  needAttendance: [],
  pendingGrading: [],
  atRisk: [],
  myClasses: [],
  b2cClasses: [
    {
      id: "b2c-a",
      code: "B2C-000003",
      name: "Starter Hero",
      program_slug: "tieng-anh",
      status: "active",
      capacity: 15,
      weekdays_text: "T2-T4",
      time_text: "18h–19h30",
      campus: null,
      start_date: null,
      student_count: 6,
    },
  ],
  b2cToday: [],
  meetings: [
    {
      id: "meeting-a",
      class_id: "b2c-a",
      code: "B2C-000003",
      name: "Starter Hero",
      starts_at: "2026-10-14T11:00:00Z",
      ends_at: "2026-10-14T12:30:00Z",
      room_name: "Phòng 201",
      status: "planned",
    },
  ],
  todayCount: 1,
};
describe("Teacher dashboard reference layout", () => {
  it("renders real KPI counts, B2C cards and actual Vietnamese date", () => {
    render(<TeacherHomeDashboard {...props} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Xin chào, Cô Lê/ }),
    ).toBeInTheDocument();
    const kpis = screen.getByRole("region", {
      name: "Tổng quan công việc hôm nay",
    });
    expect(within(kpis).getAllByRole("link")).toHaveLength(4);
    expect(
      within(kpis).getByRole("link", { name: /Buổi dạy hôm nay 1/ }),
    ).toHaveAttribute("href", "#lich-day-hom-nay");
    expect(screen.getByText("Thứ Tư, 14/10/2026")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /B2C-000003 Starter Hero 6 học viên/ }),
    ).toHaveAttribute("href", "/teacher/b2c-classes/b2c-a");
    expect(screen.getByText(/Phòng 201/)).toBeInTheDocument();
    expect(
      screen.getByText("Chưa có lớp doanh nghiệp được phân công"),
    ).toBeInTheDocument();
  });
  it("preserves cancellation without pretending that weekly classes are real sessions", () => {
    render(
      <TeacherHomeDashboard
        {...props}
        todayCount={0}
        meetings={[{ ...props.meetings[0]!, status: "cancelled" }]}
      />,
    );
    expect(screen.getByText(/Đã hủy/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lịch dạy hôm nay (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Lớp trung tâm · Theo lịch tuần"),
    ).not.toBeInTheDocument();
  });
});
