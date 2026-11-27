import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { B2CStudentTuitionOverview } from "@/features/b2c/components/student-tuition-overview";
import type { B2CStudentTuitionPage } from "@/features/b2c/domain/student-tuition";

const page: B2CStudentTuitionPage = {
  linked_student: {
    id: "11111111-1111-4111-8111-111111111111",
    code: "B2C-HV000002",
    full_name: "Lê Huỳnh Gia Hân",
  },
  periods: [
    {
      enrollment_id: "22222222-2222-4222-8222-222222222222",
      enrollment_status: "studying",
      class_id: "33333333-3333-4333-8333-333333333333",
      class_code: "LMU-01",
      class_name: "Let's Move Up",
      package_id: "44444444-4444-4444-8444-444444444444",
      period_no: 1,
      is_current: true,
      sessions: 15,
      unit_price: 183_000,
      discount: 132_000,
      total_due: 2_613_000,
      paid_amount: 2_613_000,
      balance: 0,
      receipts: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          code: "B2C-PT102",
          paid_date: "2026-11-20",
          amount: 2_613_000,
          method: "bank_transfer",
          collector_name: "Cô Tú",
          refunded_amount: 0,
          cancelled_at: null,
          effective_amount: 2_613_000,
        },
      ],
    },
  ],
};

describe("B2CStudentTuitionOverview", () => {
  it("hiển thị đúng học phí và phiếu thu của lớp B2C", () => {
    render(<B2CStudentTuitionOverview page={page} />);

    expect(screen.getByRole("heading", { name: "Let's Move Up" })).toBeInTheDocument();
    expect(screen.getAllByText("2.613.000 ₫").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("B2C-PT102")).toBeInTheDocument();
    expect(screen.getByText("Đã thanh toán đủ")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Tiến độ đóng học phí lớp trung tâm",
      }),
    ).toHaveAttribute("aria-valuenow", "100");
  });

  it("nói rõ khi lớp chưa được lập gói học phí", () => {
    render(
      <B2CStudentTuitionOverview
        page={{
          ...page,
          periods: [
            {
              ...page.periods[0]!,
              package_id: null,
              period_no: null,
              is_current: null,
              sessions: null,
              unit_price: null,
              discount: null,
              total_due: null,
              paid_amount: 0,
              balance: null,
              receipts: [],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("Trung tâm chưa lập gói học phí cho lớp này."),
    ).toBeInTheDocument();
  });
});
