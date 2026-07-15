import { describe, expect, it } from "vitest";

import {
  parseAdminReportFilters,
  reportFilterSearchParams,
} from "@/features/reports/schema";

describe("admin report filters", () => {
  it("giữ nguyên filter hợp lệ khi dựng URL export", () => {
    const parsed = parseAdminReportFilters({
      from: "2026-07-01",
      to: "2026-07-31",
      status: "overdue",
      class_id: "e3000000-0000-4000-8000-000000000001",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(reportFilterSearchParams(parsed.data).toString()).toBe(
      "from=2026-07-01&to=2026-07-31&status=overdue&class_id=e3000000-0000-4000-8000-000000000001",
    );
  });

  it("từ chối khoảng ngày đảo ngược và status ngoài enum", () => {
    expect(
      parseAdminReportFilters({ from: "2026-08-01", to: "2026-07-01" }).success,
    ).toBe(false);
    expect(parseAdminReportFilters({ status: "hacked" }).success).toBe(false);
  });
});
