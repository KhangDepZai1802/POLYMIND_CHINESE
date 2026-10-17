import { expect, it } from "vitest";
import { parentMatchesStatus, parentSummary, type ParentDashboardRow } from "@/features/b2c/domain/parent-dashboard";
const parent: ParentDashboardRow = { id: "p", full_name: "Chị An", phone: "0901234567", zalo: "0901234567", email: null, children: [] };
it("counts one parent with multiple children once and treats optional email separately", () => {
  expect(parentSummary([{ ...parent, children: [{ code: "HV1", full_name: "An", relationship: "mother", classes: [] }, { code: "HV2", full_name: "Bình", relationship: "mother", classes: [] }] }])).toEqual({ total: 1, phone: 1, zalo: 1, missing: 0 });
});
it("treats empty and whitespace contact details as missing", () => {
  expect(parentSummary([{ ...parent, phone: "  " }, { ...parent, id: "q", zalo: null }])).toEqual({ total: 2, phone: 1, zalo: 1, missing: 2 });
  expect(parentSummary([])).toEqual({ total: 0, phone: 0, zalo: 0, missing: 0 });
});
it("filters missing complete contact and unlinked parents independently", () => {
  expect(parentMatchesStatus(parent, "complete")).toBe(true);
  expect(parentMatchesStatus(parent, "missing")).toBe(false);
  expect(parentMatchesStatus(parent, "unlinked")).toBe(true);
  expect(parentMatchesStatus({ ...parent, phone: null }, "phone")).toBe(false);
});
