import { describe, expect, it } from "vitest";
import {
  b2cHistoryFilterSchema,
  historyChanges,
} from "@/features/b2c/domain/change-history";
import { getB2CNavigation } from "@/lib/permissions/navigation";
import { isRoleAllowedOnPath } from "@/lib/permissions/routes";
describe("B2C history", () => {
  it("shows actual changed fields, translates statuses, and preserves zero", () => {
    expect(
      historyChanges(
        { status: "studying", discount: 0, unit_price: 100000 },
        { status: "on_hold", discount: 0, unit_price: 120000 },
      ),
    ).toMatchObject([
      { key: "status", before: "Đang học", after: "Bảo lưu" },
      { key: "unit_price", label: "Đơn giá / buổi" },
    ]);
    expect(historyChanges(null, { discount: 0 })).toHaveLength(1);
    expect(historyChanges({ discount: 0 }, { discount: 0 })).toEqual([]);
  });
  it("rejects impossible dates, reversed dates and invalid enrollment IDs", () => {
    expect(
      b2cHistoryFilterSchema.safeParse({ from: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      b2cHistoryFilterSchema.safeParse({ from: "2026-10-14", to: "2026-10-01" })
        .success,
    ).toBe(false);
    expect(
      b2cHistoryFilterSchema.safeParse({ enrollment: "bad", page: -1 }).success,
    ).toBe(false);
  });
  it("keeps audit restricted to super admin in navigation and route permissions", () => {
    expect(
      getB2CNavigation("super_admin").some(
        (n) => n.href === "/admin/b2c/history",
      ),
    ).toBe(true);
    for (const role of ["academic_manager", "teacher", "student"] as const) {
      expect(
        getB2CNavigation(role).some((n) => n.href === "/admin/b2c/history"),
      ).toBe(false);
      expect(isRoleAllowedOnPath(role, "/admin/b2c/history")).toBe(false);
    }
  });
});
