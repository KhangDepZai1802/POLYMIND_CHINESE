import { expect, it } from "vitest";
import { needsRenewal, tuitionStatusMatches, tuitionSummary, type TuitionDashboardRow } from "@/features/b2c/domain/tuition-dashboard";
export const tuitionRow: TuitionDashboardRow = { enrollment_id: "e1", student_code: "HV1", full_name: "An", class_name: "Movers", class_id: "c1", enrollment_date: "2026-10-01", tuition_end_date: "2026-10-17", status: "studying", package_id: "p1", sessions: 10, unit_price: 100000, discount: 100000, discount_reason: "Ưu đãi", total_due: 900000, paid_amount: 400000, balance: 500000 };
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
