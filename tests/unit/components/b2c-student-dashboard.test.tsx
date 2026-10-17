import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/b2c/server/enrollment-lifecycle-actions", () => ({
  readEnrollmentLifecycleAction: vi.fn(), saveEnrollmentLifecycleAction: vi.fn(),
}));
import { StudentDashboard } from "@/features/b2c/components/student-dashboard";
vi.mock("@/features/b2c/components/class-student-add-dialog", () => ({
  ClassStudentAddDialog: () => <button>Thêm học viên</button>,
}));
import {
  studentDashboardRows,
  summarizeStudentStatus,
  tuitionExpiring,
  type StudentDashboardData,
  type StudentDashboardEnrollment,
  type StudentDashboardProfile,
} from "@/features/b2c/domain/student-dashboard";

vi.mock("@/features/b2c/components/student-status-dialog", () => ({
  B2CStudentStatusDialog: () => <button>Sửa ghi danh</button>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  BarChart: () => null,
  Bar: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));
const profile = (id: string, name: string): StudentDashboardProfile => ({
  id,
  code: `HV-${id}`,
  full_name: name,
  phone: "0901234567",
  email: null,
  date_of_birth: null,
  birth_year: null,
  address: null,
  customer_source: "facebook",
  referrer_name: null,
  guardianName: "Mẹ An",
});
const enrollment = (
  id: string,
  studentId: string,
  classId: string,
  status: StudentDashboardEnrollment["status"],
  end: string,
): StudentDashboardEnrollment => ({
  id,
  student_id: studentId,
  class_id: classId,
  status,
  withdrawal_reason: null,
  learning_goal: null,
  certificate_goal: null,
  enrollment_date: "2026-09-01",
  payment_date: null,
  learning_start_date: null,
  tuition_end_date: end,
  registered_sessions: 20,
  salesperson: "Tư vấn",
  notes: null,
});
const data: StudentDashboardData = {
  today: "2026-10-14",
  students: [profile("a", "An"), profile("b", "Bình"), profile("c", "Chi")],
  enrollments: [
    enrollment("e1", "a", "c1", "studying", "2026-10-14"),
    enrollment("e2", "a", "c2", "on_hold", "2026-11-13"),
    enrollment("e3", "b", "c1", "completed", "2026-10-20"),
  ],
  classes: [
    {
      id: "c1",
      code: "L1",
      name: "Lớp Một",
      status: "active",
      program_slug: "tieng-trung",
    },
    {
      id: "c2",
      code: "L2",
      name: "Lớp Hai",
      status: "active",
      program_slug: "tieng-anh",
    },
  ],
};
describe("student dashboard counts and deadlines", () => {
  it("preserves every enrollment and unassigned profile while assigning one chart status", () => {
    expect(studentDashboardRows(data)).toHaveLength(4);
    expect(
      summarizeStudentStatus(
        data.enrollments.filter((e) => e.student_id === "a"),
      ),
    ).toBe("studying");
    expect(summarizeStudentStatus([])).toBe("unassigned");
  });
  it("includes today and day 30, excluding expired, day 31 and completed enrollments", () => {
    const e = data.enrollments[0]!;
    expect(tuitionExpiring(e, data.today)).toBe(true);
    expect(
      tuitionExpiring({ ...e, tuition_end_date: "2026-11-13" }, data.today),
    ).toBe(true);
    expect(
      tuitionExpiring({ ...e, tuition_end_date: "2026-11-14" }, data.today),
    ).toBe(false);
    expect(
      tuitionExpiring({ ...e, tuition_end_date: "2026-10-13" }, data.today),
    ).toBe(false);
    expect(tuitionExpiring(data.enrollments[2]!, data.today)).toBe(false);
  });
});
describe("student dashboard interactions", () => {
  it("counts unique students and opens all four matching popup groups", () => {
    render(<StudentDashboard data={data} />);
    expect(
      within(
        screen.getByRole("button", { name: "Xem tổng học viên" }),
      ).getByText("3"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: "Xem đang học" })).getByText(
        "1",
      ),
    ).toBeInTheDocument();
    for (const [card, count] of [
      ["Xem tổng học viên", 3],
      ["Xem đang học", 1],
      ["Xem sắp hết học phí", 1],
      ["Xem lớp đang hoạt động", 1],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: card }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getAllByRole("row")).toHaveLength(count + 1);
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    }
  });
  it("combines class/status/date/search filters without changing overview totals", () => {
    render(<StudentDashboard data={data} />);
    fireEvent.change(screen.getByLabelText("Lọc lớp học viên"), {
      target: { value: "c2" },
    });
    fireEvent.change(screen.getByLabelText("Trạng thái học viên"), {
      target: { value: "on_hold" },
    });
    fireEvent.change(screen.getByLabelText("Tìm học viên"), {
      target: { value: "Mẹ An" },
    });
    const table = screen.getByRole("table", { name: "Danh sách học viên" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Lớp Hai")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ngày nhập học từ"), {
      target: { value: "2026-10-01" },
    });
    expect(
      within(table).getByText("Không có học viên phù hợp."),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("button", { name: "Xem tổng học viên" }),
      ).getByText("3"),
    ).toBeInTheDocument();
  });
});
