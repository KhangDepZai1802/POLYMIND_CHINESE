import { expect, it } from "vitest";
import { isCurrentTuitionEnrollment, needsRenewal, needsTuitionAttention, tuitionScopeMatches, tuitionStatusMatches, tuitionSummary, tuitionPaidAmount, tuitionReceiptMonthMatches, type TuitionDashboardRow } from "@/features/b2c/domain/tuition-dashboard";
export const tuitionRow: TuitionDashboardRow = { enrollment_id: "e1", student_code: "HV1", full_name: "An", class_name: "Movers", class_id: "c1", enrollment_date: "2026-10-01", tuition_end_date: "2026-10-17", status: "studying", student_archived_at: null, package_id: "p1", sessions: 10, unit_price: 100000, discount: 100000, discount_reason: "Ưu đãi", total_due: 900000, paid_amount: 400000, balance: 500000 };
it("counts students once across courses while summing each enrollment balance", () => {
  expect(tuitionSummary([tuitionRow, { ...tuitionRow, enrollment_id: "e2" }], "2026-10-17")).toEqual({ due: 1800000, paid: 800000, balance: 1000000, attention: 1 });
});
it("keeps unconfigured tuition distinct from debt and paid in full", () => {
  const empty = { ...tuitionRow, package_id: null, total_due: null, sessions: null, unit_price: null, discount: null, balance: 0, paid_amount: 0, tuition_end_date: null };
  expect(tuitionStatusMatches(empty, "unconfigured", "2026-10-17")).toBe(true);
  expect(tuitionStatusMatches(empty, "paid", "2026-10-17")).toBe(false);
  expect(tuitionStatusMatches(empty, "debt", "2026-10-17")).toBe(false);
});
it("uses explicit renewal status or due date, excluding inactive enrollment renewal", () => {
  expect(needsRenewal(tuitionRow, "2026-10-17")).toBe(true);
  expect(needsRenewal(tuitionRow, "2026-10-16")).toBe(false);
  expect(needsRenewal({ ...tuitionRow, tuition_end_date: null, status: "awaiting_renewal" }, "2026-10-17")).toBe(true);
  for (const status of ["completed", "transferred", "withdrawn", "on_hold"]) expect(needsRenewal({ ...tuitionRow, status }, "2026-10-17")).toBe(false);
});
it("keeps open enrollments current and distinguishes archived profiles from enrollment status", () => {
  for (const status of ["studying", "on_hold", "awaiting_renewal", "overdue"]) {
    const current = { ...tuitionRow, status };
    expect(isCurrentTuitionEnrollment(current)).toBe(true);
    expect(isCurrentTuitionEnrollment({ ...current, student_archived_at: "2026-11-10T00:00:00Z" })).toBe(false);
  }
  for (const status of ["withdrawn", "completed", "transferred", "unknown"]) {
    expect(isCurrentTuitionEnrollment({ ...tuitionRow, status })).toBe(false);
  }
});
it("retains historical receivables without asking archived students to renew", () => {
  const archived = { ...tuitionRow, student_archived_at: "2026-11-10T00:00:00Z" };
  expect(tuitionScopeMatches(archived, "current")).toBe(false);
  expect(tuitionScopeMatches(archived, "history")).toBe(true);
  expect(tuitionScopeMatches(archived, "all")).toBe(true);
  expect(tuitionScopeMatches(tuitionRow, "history")).toBe(false);
  expect(needsRenewal(archived, "2026-11-23")).toBe(false);
  expect(needsTuitionAttention(archived, "2026-11-23")).toBe(true);
  expect(needsTuitionAttention({ ...archived, balance: 0 }, "2026-11-23")).toBe(false);
  expect(tuitionSummary([archived], "2026-11-23")).toEqual({ due: 900000, paid: 400000, balance: 500000, attention: 1 });
});

it("summarizes only the selected receipt month without changing whole-package due or debt", () => {
  const row = { ...tuitionRow, paid_by_month: { "2026-10": 300000, "2026-11": 100000 } };
  expect(tuitionSummary([row], "2026-11-26", "2026-11")).toEqual({ due: 900000, paid: 100000, balance: 500000, attention: 1 });
  expect(tuitionPaidAmount(row)).toBe(400000);
  expect(tuitionPaidAmount(row, "2026-12")).toBe(0);
  expect(row.paid_amount).toBe(400000);
});

it("distinguishes months with cancelled receipts from months without any receipts", () => {
  const row = { ...tuitionRow, paid_by_month: { "2026-11": 0 } };
  expect(tuitionReceiptMonthMatches(row, "2026-11")).toBe(true);
  expect(tuitionReceiptMonthMatches(row, "2026-12")).toBe(false);
  expect(tuitionReceiptMonthMatches({ ...row, paid_by_month: {} }, "2026-11")).toBe(false);
  expect(tuitionReceiptMonthMatches(tuitionRow, "")).toBe(true);
});

it("does not substitute a zero total when monthly data has not been loaded", () => {
  expect(() => tuitionPaidAmount(tuitionRow, "2026-11")).toThrow("Chưa tải được");
  expect(() => tuitionReceiptMonthMatches(tuitionRow, "2026-11")).toThrow("Chưa tải được");
});
