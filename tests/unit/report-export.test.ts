import { describe, expect, it } from "vitest";

import { createReportCsv, createReportXlsx } from "@/features/reports/export";
import type { AdminTuitionReport } from "@/features/reports/server/admin-queries";

const report = {
  summary: { invoices: 1, total: 1000, paid: 400, balance: 600, overdue: 1 },
  rows: [
    {
      invoice_id: "invoice-1",
      invoice_code: "=DANGEROUS",
      student_id: "student-1",
      class_id: "class-1",
      issue_date: "2026-07-01",
      due_date: "2026-07-10",
      total: 1000,
      status: "overdue" as const,
      paid_amount: 400,
      balance: 600,
      is_overdue: true,
      student: { id: "student-1", student_code: "HV-01", full_name: "Nguyễn An" },
      class: { id: "class-1", code: "LOP-01", name: "Tiếng Trung cơ bản" },
    },
  ],
} satisfies AdminTuitionReport;

describe("report export", () => {
  it("tạo CSV UTF-8 và vô hiệu hóa spreadsheet formula", () => {
    const csv = createReportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=DANGEROUS");
    expect(csv).toContain("Nguyễn An");
  });

  it("tạo workbook XLSX thật", async () => {
    const buffer = Buffer.from(await createReportXlsx(report));
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
