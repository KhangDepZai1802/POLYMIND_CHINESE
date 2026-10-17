import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "@/features/b2c/components/teacher-dashboard";
vi.mock("@/features/teachers/server/account-actions", () => ({
  readTeacherAccountAction: vi.fn(), changeTeacherPasswordAction: vi.fn(),
}));
vi.mock("@/features/b2c/server/permission-actions", () => ({ readB2CPermissionAdminAction: vi.fn(), saveB2CPermissionsAction: vi.fn() }));

vi.mock("@/features/b2c/components/teacher-dialog", () => ({
  B2CTeacherDialog: () => <button>Sửa hồ sơ</button>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));
const rows = [
  {
    teacher: {
      id: "a",
      full_name: "Cô An",
      phone: null,
      email: null,
      specialization: "Tiếng Trung",
      employment_type: null,
      hourly_rate: null,
    },
    teachingMonths: ["2026-10"],
    assignedClasses: [
      { id: "c1", code: "TR-01", name: "Lớp Trung 1", studentCount: 3 },
      { id: "c2", code: "TR-02", name: "Lớp Trung 2", studentCount: 3 },
    ],
    classCount: 2,
    averageSize: 3,
    repeatPaymentRate: null,
    renewalAfterExpiryRate: 0,
    costRatio: null,
    salary: 0,
    revenue: 0,
  },
  {
    teacher: {
      id: "b",
      full_name: "Cô Bình",
      phone: "0901234567",
      email: null,
      specialization: "Tiếng Anh",
      employment_type: null,
      hourly_rate: null,
    },
    teachingMonths: ["2026-09"],
    assignedClasses: [
      { id: "c3", code: "AN-01", name: "Lớp Anh 1", studentCount: 4 },
    ],
    classCount: 1,
    averageSize: 4,
    repeatPaymentRate: null,
    renewalAfterExpiryRate: null,
    costRatio: null,
    salary: 0,
    revenue: 0,
  },
];
describe("B2C teacher dashboard", () => {
  it("keeps legacy scope labels out of specialty display and preserves timetable access", () => {
    render(<TeacherDashboard rows={rows.map(r => ({ ...r, teacher: { ...r.teacher, specialization: "B2C" } }))} initialMonth="2026-10" />);
    expect(screen.getByRole("link", { name: "Xem thời khóa biểu giáo viên" })).toHaveAttribute("href", "/admin/b2c/timetable");
    expect(screen.getByRole("combobox", { name: "Lọc chuyên môn" })).toContainHTML("Chưa cập nhật");
    expect(screen.queryByRole("option", { name: "B2C" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lọc chuyên môn"), { target: { value: "Chưa cập nhật" } });
    expect(within(screen.getByRole("table")).getByText("Cô An")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Cô Bình")).toBeInTheDocument();
  });
  it("opens each card with the matching teacher group or class list", () => {
    render(<TeacherDashboard rows={rows} initialMonth="2026-10" />);
    for (const [card, included, excluded] of [
      ["Xem tổng giáo viên", "Cô An", null],
      ["Xem có lịch dạy", "Cô An", "Cô Bình"],
      ["Xem chưa có lịch dạy", "Cô Bình", "Cô An"],
      ["Xem tổng số lớp phụ trách", "Lớp Trung 1", null],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: card }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(included)).toBeInTheDocument();
      if (excluded)
        expect(within(dialog).queryByText(excluded)).not.toBeInTheDocument();
      if (card === "Xem tổng số lớp phụ trách") {
        expect(within(dialog).getByText("Lớp Trung 2")).toBeInTheDocument();
        expect(within(dialog).getByText("Lớp Anh 1")).toBeInTheDocument();
      }
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });
  it("matches card specialization and month, and searches within the popup", () => {
    render(<TeacherDashboard rows={rows} initialMonth="2026-09" />);
    fireEvent.change(screen.getByLabelText("Lọc chuyên môn"), {
      target: { value: "Tiếng Anh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xem có lịch dạy" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Cô Bình")).toBeInTheDocument();
    expect(within(dialog).queryByText("Cô An")).not.toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByLabelText("Tìm giáo viên trong popup"),
      { target: { value: "0901234567" } },
    );
    expect(within(dialog).getByText("Cô Bình")).toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByLabelText("Tìm giáo viên trong popup"),
      { target: { value: "không có" } },
    );
    expect(
      within(dialog).getByText("Không có kết quả phù hợp."),
    ).toBeInTheDocument();
  });
  it("filters teaching status by the selected month and keeps missing metrics unknown", () => {
    render(<TeacherDashboard rows={rows} initialMonth="2026-10" />);
    const table = screen.getByRole("table");
    fireEvent.change(screen.getByLabelText("Lọc tình trạng lịch dạy"), {
      target: { value: "teaching" },
    });
    expect(within(table).getByText("Cô An")).toBeInTheDocument();
    expect(within(table).queryByText("Cô Bình")).not.toBeInTheDocument();
    expect(within(table).getByText("0%")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tháng theo dõi lịch dạy"), {
      target: { value: "2026-09" },
    });
    expect(within(table).getByText("Cô Bình")).toBeInTheDocument();
    expect(within(table).queryByText("Cô An")).not.toBeInTheDocument();
  });
  it("combines specialization and contact search and handles empty results", () => {
    render(<TeacherDashboard rows={rows} initialMonth="2026-10" />);
    fireEvent.change(screen.getByLabelText("Lọc chuyên môn"), {
      target: { value: "Tiếng Anh" },
    });
    fireEvent.change(screen.getByLabelText("Tìm giáo viên"), {
      target: { value: "0901234567" },
    });
    expect(
      within(screen.getByRole("table")).getByText("Cô Bình"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tìm giáo viên"), {
      target: { value: "không có" },
    });
    expect(screen.getByText("Không có giáo viên phù hợp.")).toBeInTheDocument();
  });
});
