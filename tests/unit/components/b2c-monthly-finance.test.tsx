import { act, fireEvent, render, screen } from "@testing-library/react";
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
