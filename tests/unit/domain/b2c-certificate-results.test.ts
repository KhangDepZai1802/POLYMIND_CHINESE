import { describe, expect, it } from "vitest";
import { certificateFiltersSchema, certificateResultSchema } from "@/features/b2c/domain/certificate-results";
import { buildCertificateMarketingWorkbook } from "@/features/b2c/certificate-marketing-export";
const id = "17500000-0000-4000-8000-000000000001";
describe("B2C certificate results", () => {
  it("preserves differing score formats without inventing a shared scale", () => {
    const base = { request_id: id, id: null, expected_updated_at: null, student_id: id, certificate_type: "IELTS", level: "", score: "6.5", exam_date: "2026-10-17", marketing_allowed: false, marketing_note: "", notes: "" };
    for (const score of ["6.5", "180/200", "Pass", "0"]) expect(certificateResultSchema.parse({ ...base, score }).score).toBe(score);
    expect(certificateResultSchema.safeParse({ ...base, score: " " }).success).toBe(false);
    expect(certificateResultSchema.safeParse({ ...base, student_id: "An" }).success).toBe(false);
  });
  it("validates filters and preserves explicit marketing choice", () => {
    expect(certificateFiltersSchema.parse({}).marketing).toBe("all");
    expect(certificateFiltersSchema.safeParse({ from: "2026-10-17", to: "2026-10-01" }).success).toBe(false);
    expect(certificateFiltersSchema.safeParse({ marketing: "public" }).success).toBe(false);
  });
  it("exports six public-facing columns and treats formula-looking values as text", async () => {
    const workbook = buildCertificateMarketingWorkbook([{ student_code: "HV1", full_name: '=HYPERLINK("https://example.test")', certificate_type: "IELTS", level: "Academic", score: "6.5", exam_date: "2026-10-17" }]);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Expected a certificate worksheet");
    expect(sheet.columnCount).toBe(6);
    expect(sheet.getCell("B2").type).toBe(3);
    expect(sheet.getCell("B2").formula).toBeUndefined();
    expect(sheet.getCell("F2").value).toBe("17/10/2026");
    const headers = sheet.getRow(1).values;
    expect(JSON.stringify(headers)).not.toMatch(/email|SĐT|Ghi chú/);
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0);
  });
});
