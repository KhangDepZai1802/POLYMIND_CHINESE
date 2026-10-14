import { describe, expect, it } from "vitest";

import { b2cMonthlyReportSchema } from "@/features/b2c/schema";

const validReport = {
  report_year: 2026,
  report_month: 8,
  revenue: 58_040_000,
  electricity: 1_164_197,
  water: 204_863,
  internet: 206_500,
  teacher_payroll: 50_000_000,
  office_payroll: 7_137_000,
  rent: 12_000_000,
  marketing: 0,
  advertising: 0,
  other: 9_367_000,
  notes: "Nhập từ Excel",
  metrics: [
    {
      program_slug: "tieng-anh",
      opening_students: 27,
      new_students: 0,
      departed_students: 0,
      lessons_taught: 0,
      lessons_paid: 0,
    },
  ],
};

describe("b2cMonthlyReportSchema", () => {
  it("requires explicit teacher/office payroll and marketing, accepting a deliberate zero", () => {
    for (const field of ["teacher_payroll", "office_payroll", "marketing"]) {
      for (const empty of ["", null, undefined])
        expect(
          b2cMonthlyReportSchema.safeParse({ ...validReport, [field]: empty })
            .success,
        ).toBe(false);
      expect(
        b2cMonthlyReportSchema.safeParse({ ...validReport, [field]: 0 })
          .success,
      ).toBe(true);
    }
  });
  it("nhận báo cáo hợp lệ từ file tháng", () => {
    expect(b2cMonthlyReportSchema.parse(validReport).revenue).toBe(58_040_000);
  });

  it("không nhận tháng ngoài 1–12", () => {
    expect(
      b2cMonthlyReportSchema.safeParse({ ...validReport, report_month: 13 })
        .success,
    ).toBe(false);
  });

  it("không nhận chi phí âm", () => {
    expect(
      b2cMonthlyReportSchema.safeParse({ ...validReport, teacher_payroll: -1 })
        .success,
    ).toBe(false);
  });

  it("không cho số học viên giảm vượt số đang có", () => {
    expect(
      b2cMonthlyReportSchema.safeParse({
        ...validReport,
        metrics: [
          {
            ...validReport.metrics[0],
            opening_students: 2,
            departed_students: 3,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
