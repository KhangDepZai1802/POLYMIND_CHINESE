import type { Metadata } from "next";
import Link from "next/link";

import { Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
} from "@/lib/domain/labels";
import {
  parseAdminReportFilters,
  reportFilterSearchParams,
} from "@/features/reports/schema";
import {
  getAdminReportClasses,
  getAdminTuitionReport,
} from "@/features/reports/server/admin-queries";

export const metadata: Metadata = { title: "Báo cáo" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default async function AdminReportsPage({ searchParams }: Props) {
  await requireRole("super_admin");
  const parsed = parseAdminReportFilters(await searchParams);
  const filters = parsed.success ? parsed.data : {};
  const [report, classes] = await Promise.all([
    getAdminTuitionReport(filters),
    getAdminReportClasses(),
  ]);
  const exportParams = reportFilterSearchParams(filters);

  return (
    <>
      <PageHeader
        title="Báo cáo học phí"
        description="Số liệu hóa đơn theo đúng khoảng ngày, lớp và trạng thái đang chọn."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-sm font-medium">
              Từ ngày
              <DatePicker name="from" defaultValue={filters.from} placeholder="Chọn ngày" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Đến ngày
              <DatePicker name="to" defaultValue={filters.to} placeholder="Chọn ngày" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Lớp
              <select
                name="class_id"
                defaultValue={filters.class_id ?? ""}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Tất cả lớp</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Trạng thái
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">Áp dụng</Button>
              <Button asChild variant="ghost">
                <Link href="/admin/reports">Xóa lọc</Link>
              </Button>
            </div>
          </form>
          {!parsed.success && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {parsed.error.issues[0]?.message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Hóa đơn" value={String(report.summary.invoices)} />
        <Summary label="Tổng tiền" value={money.format(report.summary.total)} />
        <Summary label="Đã thu" value={money.format(report.summary.paid)} />
        <Summary label="Còn lại" value={money.format(report.summary.balance)} />
        <Summary label="Quá hạn" value={String(report.summary.overdue)} />
      </div>

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {(["csv", "xlsx"] as const).map((format) => {
          const params = new URLSearchParams(exportParams);
          params.set("format", format);
          return (
            <Button key={format} asChild variant="outline">
              <a href={`/api/export/reports?${params.toString()}`}>
                <Download /> Xuất {format.toUpperCase()}
              </a>
            </Button>
          );
        })}
      </div>

      <Card>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                {[
                  "Hóa đơn",
                  "Ngày phát hành",
                  "Học viên",
                  "Lớp",
                  "Trạng thái",
                  "Tổng tiền",
                  "Đã thu",
                  "Còn lại",
                ].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.invoice_id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{row.invoice_code}</td>
                  <td className="px-4 py-3">{row.issue_date}</td>
                  <td className="px-4 py-3">
                    {row.student?.student_code} — {row.student?.full_name}
                  </td>
                  <td className="px-4 py-3">{row.class?.code ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.status && (
                      <StatusBadge
                        tone={INVOICE_STATUS_TONE[row.status]}
                        label={INVOICE_STATUS_LABELS[row.status]}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{money.format(row.total)}</td>
                  <td className="px-4 py-3 text-right">
                    {money.format(row.paid_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">{money.format(row.balance)}</td>
                </tr>
              ))}
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Không có hóa đơn phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
