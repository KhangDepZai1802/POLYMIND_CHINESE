import { describe, expect, it } from "vitest";
import {
  estimateBreakEven,
  monthlyTotalCost,
} from "@/features/b2c/domain/finance";
const report = {
  revenue: 20_000_000,
  electricity_cost: 0,
  water_cost: 0,
  internet_cost: 0,
  payroll_cost: 10_000_000,
  teacher_payroll_cost: 8_000_000,
  office_payroll_cost: 2_000_000,
  rent_cost: 10_000_000,
  marketing_cost: 2_000_000,
  advertising_cost: 0,
  other_cost: 0,
};
describe("B2C finance", () => {
  it("counts combined payroll once and rounds required students up", () => {
    expect(monthlyTotalCost(report)).toBe(22_000_000);
    expect(estimateBreakEven(report, 20)).toMatchObject({
      requiredStudents: 24,
      currentStudents: 20,
      shortfall: 4,
      fixedCost: 14_000_000,
      revenuePerStudent: 1_000_000,
      variableCostPerStudent: 400_000,
    });
  });
  it("keeps historical combined payroll totals but refuses to guess a split", () => {
    const historical = {
      ...report,
      teacher_payroll_cost: null,
      office_payroll_cost: null,
    };
    expect(monthlyTotalCost(historical)).toBe(22_000_000);
    expect(estimateBreakEven(historical, 20).requiredStudents).toBeNull();
  });
  it("handles no students and nonpositive contribution without a misleading zero target", () => {
    expect(estimateBreakEven(report, 0).requiredStudents).toBeNull();
    expect(
      estimateBreakEven({ ...report, revenue: 8_000_000 }, 20).requiredStudents,
    ).toBeNull();
    expect(
      estimateBreakEven({ ...report, revenue: 7_000_000 }, 20).requiredStudents,
    ).toBeNull();
  });
  it("shows zero shortfall when already beyond break even", () => {
    expect(
      estimateBreakEven({ ...report, revenue: 40_000_000 }, 20),
    ).toMatchObject({ requiredStudents: 9, shortfall: 0 });
  });
});
