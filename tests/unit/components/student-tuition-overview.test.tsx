import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudentTuitionOverview } from "@/features/tuition/components/student-tuition-overview";
import type { TuitionInvoiceRecord } from "@/features/tuition/types";

function invoice(
  overrides: Partial<TuitionInvoiceRecord> = {},
): TuitionInvoiceRecord {
  return {
    id: "invoice-1",
    invoice_code: "HD-2026-001",
    student_id: "student-1",
    enrollment_id: "enrollment-1",
    class_id: "class-1",
    issue_date: "2026-07-01",
    due_date: "2026-07-15",
    subtotal: 3_000_000,
    discount: 0,
    total: 3_000_000,
    status: "issued",
    note: null,
    created_at: "2026-07-01T00:00:00Z",
    student: null,
    enrollment: {
      id: "enrollment-1",
      status: "active",
      class: { id: "class-1", code: "HSK1-A", name: "HSK 1 buổi tối" },
    },
    tuition_invoice_items: [
      {
        id: "item-1",
        description: "Học phí khóa HSK 1",
        quantity: 1,
        unit_amount: 3_000_000,
        line_total: 3_000_000,
      },
    ],
    tuition_payments: [],
    paid_amount: 1_200_000,
    balance: 1_800_000,
    is_overdue: false,
    ...overrides,
  } as TuitionInvoiceRecord;
}

describe("StudentTuitionOverview", () => {
  it("có heading cấp 2 cho từng khu vực và cấp 3 cho từng hóa đơn", () => {
    render(<StudentTuitionOverview invoices={[invoice()]} />);

    expect(
      screen.getByRole("heading", { name: "Tổng quan học phí", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Hóa đơn của bạn (1)", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "HD-2026-001", level: 3 }),
    ).toBeInTheDocument();
  });

  it("thanh tiến độ đóng học phí đọc được bằng tiền, không chỉ bằng phần trăm", () => {
    render(<StudentTuitionOverview invoices={[invoice()]} />);

    const bar = screen.getByRole("progressbar", {
      name: "Tiến độ đóng học phí",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar.getAttribute("aria-valuetext")).toContain("Đã đóng");
  });

  it("tổng bằng 0 thì không vẽ thanh tiến độ — tránh chia cho 0", () => {
    render(
      <StudentTuitionOverview
        invoices={[
          invoice({ subtotal: 0, total: 0, paid_amount: 0, balance: 0 }),
        ]}
      />,
    );

    expect(
      screen.queryByRole("progressbar", { name: "Tiến độ đóng học phí" }),
    ).not.toBeInTheDocument();
  });

  it("hiện Tạm tính và Giảm trừ khi có giảm trừ — dữ liệu trước đây bị bỏ không", () => {
    render(
      <StudentTuitionOverview
        invoices={[
          invoice({
            subtotal: 3_000_000,
            discount: 500_000,
            total: 2_500_000,
            balance: 1_300_000,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Tạm tính")).toBeInTheDocument();
    expect(screen.getByText("Giảm trừ")).toBeInTheDocument();
  });

  it("không có giảm trừ thì không thêm hai dòng gây nhiễu", () => {
    render(<StudentTuitionOverview invoices={[invoice()]} />);

    expect(screen.queryByText("Tạm tính")).not.toBeInTheDocument();
    expect(screen.queryByText("Giảm trừ")).not.toBeInTheDocument();
  });

  it("không quá hạn thì nói bằng chữ, không để màu là kênh duy nhất", () => {
    render(<StudentTuitionOverview invoices={[invoice()]} />);

    expect(screen.getByText("Không có hóa đơn quá hạn.")).toBeInTheDocument();
  });

  it("có hóa đơn quá hạn thì cảnh báo nêu đúng số lượng", () => {
    render(
      <StudentTuitionOverview
        invoices={[invoice({ is_overdue: true, status: "overdue" })]}
      />,
    );

    expect(screen.getByText(/1 hóa đơn đã quá hạn/)).toBeInTheDocument();
    expect(screen.getByText("Cần xử lý sớm.")).toBeInTheDocument();
  });

  it("chưa có hóa đơn thì hiện empty state, không hiện khối tổng quan", () => {
    render(<StudentTuitionOverview invoices={[]} />);

    expect(screen.getByText("Chưa có hóa đơn học phí")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Tổng quan học phí" }),
    ).not.toBeInTheDocument();
  });
});
