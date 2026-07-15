import { describe, expect, it } from "vitest";

import {
  tuitionInvoiceSchema,
  tuitionPaymentSchema,
} from "@/features/tuition/schema";

const BASE = {
  invoice_id: "",
  student_id: "11111111-1111-4111-8111-111111111111",
  enrollment_id: "none",
  issue_date: "2026-07-15",
  due_date: "2026-07-31",
  discount: "50000",
  note: "",
  items: [
    { description: "Học phí", quantity: "2", unit_amount: "100000" },
    { description: "Giáo trình", quantity: "1", unit_amount: "150000" },
  ],
};

describe("tuitionInvoiceSchema", () => {
  it("chuẩn hóa field tùy chọn và số tiền hợp lệ", () => {
    const parsed = tuitionInvoiceSchema.safeParse(BASE);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.invoice_id).toBeNull();
    expect(parsed.data?.enrollment_id).toBeNull();
    expect(parsed.data?.note).toBeNull();
    expect(parsed.data?.discount).toBe(50000);
    expect(parsed.data?.items[0]?.quantity).toBe(2);
  });

  it("từ chối hóa đơn không có khoản mục", () => {
    expect(tuitionInvoiceSchema.safeParse({ ...BASE, items: [] }).success).toBe(
      false,
    );
  });

  it("từ chối số lượng không dương hoặc đơn giá âm", () => {
    for (const item of [
      { description: "Sai số lượng", quantity: "0", unit_amount: "1000" },
      { description: "Sai đơn giá", quantity: "1", unit_amount: "-1" },
    ]) {
      expect(
        tuitionInvoiceSchema.safeParse({ ...BASE, items: [item] }).success,
      ).toBe(false);
    }
  });

  it("từ chối hạn thanh toán trước ngày lập", () => {
    expect(
      tuitionInvoiceSchema.safeParse({ ...BASE, due_date: "2026-07-01" })
        .success,
    ).toBe(false);
  });

  it("từ chối giảm trừ vượt tạm tính", () => {
    expect(
      tuitionInvoiceSchema.safeParse({ ...BASE, discount: "400000" }).success,
    ).toBe(false);
  });
});

describe("tuitionPaymentSchema", () => {
  const payment = {
    invoice_id: "22222222-2222-4222-8222-222222222222",
    amount: "500000",
    method: "bank_transfer",
    paid_at: "2026-07-15T14:30",
    reference: "  VCB-001  ",
    note: "",
  };

  it("chuẩn hóa số tiền và field tùy chọn", () => {
    const parsed = tuitionPaymentSchema.safeParse(payment);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.amount).toBe(500000);
    expect(parsed.data?.reference).toBe("VCB-001");
    expect(parsed.data?.note).toBeNull();
  });

  it("từ chối số tiền bằng 0 hoặc âm", () => {
    for (const amount of ["0", "-1"]) {
      expect(
        tuitionPaymentSchema.safeParse({ ...payment, amount }).success,
      ).toBe(false);
    }
  });

  it("từ chối datetime không đúng định dạng local", () => {
    expect(
      tuitionPaymentSchema.safeParse({
        ...payment,
        paid_at: "15/07/2026 14:30",
      }).success,
    ).toBe(false);
  });
});
