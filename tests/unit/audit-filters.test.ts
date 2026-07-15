import { describe, expect, it } from "vitest";

import { auditFilterSearchParams, parseAuditFilters } from "@/features/audit/schema";

describe("audit filters", () => {
  it("chuẩn hóa filter và giữ chúng khi chuyển trang", () => {
    const parsed = parseAuditFilters({
      action: " tuition ",
      from: "2026-07-01",
      to: "2026-07-31",
      page: "2",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.action).toBe("tuition");
    expect(auditFilterSearchParams(parsed.data).toString()).toBe(
      "action=tuition&from=2026-07-01&to=2026-07-31&page=2",
    );
  });

  it("từ chối UUID actor và khoảng ngày không hợp lệ", () => {
    expect(parseAuditFilters({ actor_id: "not-uuid" }).success).toBe(false);
    expect(parseAuditFilters({ from: "2026-08-01", to: "2026-07-01" }).success).toBe(
      false,
    );
  });
});
