import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  B2CMonthlyReportDashboard,
  type MonthlyReport,
} from "@/features/b2c/components/monthly-report-dashboard";
vi.mock("@/features/b2c/server/actions", () => ({
  saveB2CMonthlyReportAction: vi.fn(async () => ({})),
}));
const report: MonthlyReport = {
  id: "r1",
  report_year: 2026,
  report_month: 9,
  revenue: 200,
  electricity_cost: 0,
  water_cost: 0,
  internet_cost: 0,
  payroll_cost: 100,
  teacher_payroll_cost: null,
  office_payroll_cost: null,
  rent_cost: 20,
  marketing_cost: 0,
  advertising_cost: 0,
  other_cost: 5,
  notes: null,
  updated_at: "2026-10-14T00:00:00Z",
  metrics: [],
};
describe("monthly finance form", () => {
  it("preserves program figures and sorts the report table without changing the edit form", () => {
    render(<B2CMonthlyReportDashboard reports={[{ ...report, metrics: [
      { report_id: "r1", program_slug: "tieng-anh", opening_students: 10, new_students: 2, departed_students: 1, lessons_taught: 8, lessons_paid: 10 },
      { report_id: "r1", program_slug: "tieng-trung", opening_students: 20, new_students: 1, departed_students: 3, lessons_taught: 5, lessons_paid: 9 },
    ] }]} />);
    const table = within(screen.getByRole("table", { name: "Học viên và số tiết theo chương trình" }));
    expect(table.getAllByRole("row")[1]).toHaveTextContent("Tiếng Anh");
    fireEvent.click(table.getByRole("button", { name: "Giảm" }));
    fireEvent.click(table.getByRole("button", { name: "Giảm" }));
    const first = table.getAllByRole("row")[1]!;
    expect(first).toHaveTextContent("Tiếng Trung");
    expect(within(first).getAllByRole("cell").map(c => c.textContent)).toEqual(["18", "1", "3", "5", "4"]);
    expect(screen.getByLabelText("Doanh thu (VNĐ)")).toHaveValue(200);
    expect(screen.getByText("Chỉnh sửa số liệu tháng này").closest("details")).not.toHaveAttribute("open");
  });
  it("hydrates the server period even when the client clock crosses a year", async () => {
    const props = { reports: [report], initialPeriod: { month: 12, year: 2026 } };
    vi.useFakeTimers();
    const container = document.createElement("div");
    const recoverable = vi.fn();
    try {
      vi.setSystemTime(new Date("2026-12-31T16:59:59Z"));
      container.innerHTML = renderToString(<B2CMonthlyReportDashboard {...props} />);
      vi.setSystemTime(new Date("2027-01-01T01:00:00Z"));
      let root: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(container, <B2CMonthlyReportDashboard {...props} />, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      const expectedDate = new Date(report.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      expect(container.textContent).toContain(expectedDate);
      const select = container.querySelector("select")!;
      fireEvent.change(select, { target: { value: "new" } });
      expect(container.querySelector<HTMLInputElement>('[name="report_month"]')?.value).toBe("12");
      expect(container.querySelector<HTMLInputElement>('[name="report_year"]')?.value).toBe("2026");
      await act(async () => root!.unmount());
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps historical payroll unclassified and requires manual allocation", () => {
    render(<B2CMonthlyReportDashboard reports={[report]} />);
    expect(
      screen.getByText("Lương gộp chưa phân loại (dữ liệu cũ)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lương giáo viên (VNĐ)")).toHaveValue(null);
    expect(screen.getByLabelText("Lương NV văn phòng (VNĐ)")).toHaveValue(null);
    expect(screen.getByLabelText("Lương giáo viên (VNĐ)")).toBeRequired();
  });
  it("requires explicit Marketing for a new period and loads classified payroll", () => {
    render(
      <B2CMonthlyReportDashboard
        reports={[
          { ...report, teacher_payroll_cost: 70, office_payroll_cost: 30 },
        ]}
      />,
    );
    expect(screen.getByLabelText("Lương giáo viên (VNĐ)")).toHaveValue(70);
    expect(screen.getByLabelText("Lương NV văn phòng (VNĐ)")).toHaveValue(30);
    expect(
      screen.queryByText("Lương gộp chưa phân loại (dữ liệu cũ)"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kỳ báo cáo"), {
      target: { value: "new" },
    });
    expect(screen.getByLabelText("Marketing (VNĐ)")).toHaveValue(null);
    expect(screen.getByLabelText("Marketing (VNĐ)")).toBeRequired();
  });
});
