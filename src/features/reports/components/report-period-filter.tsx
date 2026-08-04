import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/lib/dates";

import { monthRangeOf, weekRangeOf, type LearningPeriod } from "../learning";
import type { LearningReportFilters } from "../schema";

/**
 * Thanh chọn kỳ báo cáo (D4): ba preset + khoảng ngày tự chọn, tất cả nằm trên
 * URL — deep-link được, bấm Back giữ nguyên kỳ, export đọc lại đúng kỳ này.
 *
 * `hiddenParams` để trang nào có tham số riêng (ví dụ `?class=` của trang giáo
 * viên, `?tab=` của trang admin) không bị rơi mất khi đổi kỳ.
 */
export function ReportPeriodFilter({
  basePath,
  filters,
  period,
  hiddenParams = {},
  errorMessage,
}: {
  basePath: string;
  filters: LearningReportFilters;
  period: LearningPeriod;
  hiddenParams?: Record<string, string>;
  errorMessage?: string;
}) {
  const today = todayISO();
  const week = weekRangeOf(today);
  const month = monthRangeOf(today);

  const presetHref = (params: Record<string, string>) => {
    const search = new URLSearchParams({ ...hiddenParams, ...params });
    return `${basePath}?${search.toString()}`;
  };

  const presets: { key: LearningPeriod["preset"]; label: string; href: string }[] =
    [
      {
        key: "week",
        label: "Tuần này",
        href: presetHref({ from: week.from, to: week.to }),
      },
      {
        key: "month",
        label: "Tháng này",
        href: presetHref({ from: month.from, to: month.to }),
      },
      { key: "all", label: "Toàn khóa", href: presetHref({ range: "all" }) },
    ];

  return (
    <Card data-noprint className="mb-4 py-3">
      <CardContent className="px-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div
            role="group"
            aria-label="Chọn nhanh kỳ báo cáo"
            className="flex flex-wrap gap-2"
          >
            {presets.map((preset) => {
              const active = period.preset === preset.key;
              return (
                <Button
                  key={preset.key}
                  asChild
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                >
                  <Link
                    href={preset.href}
                    aria-current={active ? "true" : undefined}
                    className={active ? "font-semibold" : undefined}
                  >
                    {preset.label}
                  </Link>
                </Button>
              );
            })}
          </div>

          <form
            action={basePath}
            className="flex flex-wrap items-end gap-x-3 gap-y-3"
          >
            {Object.entries(hiddenParams).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <label className="grid gap-1 text-sm font-medium">
              Từ ngày
              <DatePicker
                name="from"
                defaultValue={filters.from}
                placeholder="Chọn ngày"
                className="w-40"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Đến ngày
              <DatePicker
                name="to"
                defaultValue={filters.to}
                placeholder="Chọn ngày"
                className="w-40"
              />
            </label>
            <Button type="submit" variant="outline">
              Áp dụng
            </Button>
          </form>

          <p className="text-muted-foreground ml-auto text-sm">
            Đang xem: <span className="font-medium">{period.label}</span>
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
