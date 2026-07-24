import type { Metadata } from "next";
import Link from "next/link";

import { Download } from "lucide-react";

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
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

      <Card className="mb-4 gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle asChild className="text-base">
            <h2>Bộ lọc</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-sm font-medium">
              Từ ngày
              <DatePicker
                name="from"
                defaultValue={filters.from}
                placeholder="Chọn ngày"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Đến ngày
              <DatePicker
                name="to"
                defaultValue={filters.to}
                placeholder="Chọn ngày"
              />
            </label>
            {/*
             * `NativeSelect` chứ không phải `<select>` tự dựng: hai ô này là bản
             * chép thứ 7 và thứ 8 của chuỗi class đã gom ở `P17-T1`, và cả hai
             * đều dùng `border` (**1.27:1** trên nền trắng — gần như vô hình)
             * thay vì `border-input` (**3.39:1**), kèm `h-9` lệch 4px so với
             * thang control `h-10` của `DS-013`.
             */}
            <div className="grid gap-1">
              <label htmlFor="report-class" className="text-sm font-medium">
                Lớp
              </label>
              <NativeSelect
                id="report-class"
                name="class_id"
                defaultValue={filters.class_id ?? ""}
              >
                <option value="">Tất cả lớp</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1">
              <label htmlFor="report-status" className="text-sm font-medium">
                Trạng thái
              </label>
              <NativeSelect
                id="report-status"
                name="status"
                defaultValue={filters.status ?? ""}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Áp dụng</Button>
              <Button asChild variant="ghost">
                <Link href="/admin/reports">Xóa lọc</Link>
              </Button>
            </div>
          </form>
          {!parsed.success && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {parsed.error.issues[0]?.message}
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="report-summary-heading" className="mb-4">
        <h2 id="report-summary-heading" className="sr-only">
          Tổng hợp theo bộ lọc đang chọn
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label="Hóa đơn" value={String(report.summary.invoices)} />
          <Summary label="Tổng tiền" value={money.format(report.summary.total)} />
          <Summary label="Đã thu" value={money.format(report.summary.paid)} />
          <Summary label="Còn lại" value={money.format(report.summary.balance)} />
          <Summary label="Quá hạn" value={String(report.summary.overdue)} />
        </div>
      </section>

      <div className="mb-3 flex flex-wrap justify-end gap-2">
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

      <Card className="py-0">
        <CardContent className="p-0">
          <DataTable
            caption="Chi tiết hóa đơn theo bộ lọc đang chọn: mã hóa đơn, ngày phát hành, học viên, lớp, trạng thái và số tiền"
            minWidthClass="min-w-[60rem]"
          >
            <DataTableHeader>
              <tr>
                <DataTableHead sticky>Hóa đơn</DataTableHead>
                <DataTableHead>Ngày phát hành</DataTableHead>
                <DataTableHead>Học viên</DataTableHead>
                <DataTableHead>Lớp</DataTableHead>
                <DataTableHead>Trạng thái</DataTableHead>
                <DataTableHead numeric>Tổng tiền</DataTableHead>
                <DataTableHead numeric>Đã thu</DataTableHead>
                <DataTableHead numeric>Còn lại</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {report.rows.map((row) => (
                <DataTableRow key={row.invoice_id}>
                  <DataTableCell sticky className="font-medium">
                    {row.invoice_code}
                  </DataTableCell>
                  {/*
                   * `formatDateOnly`, KHÔNG in thẳng `row.issue_date`.
                   * `v_tuition_balance.issue_date` là cột `date`, PostgREST trả
                   * về chuỗi "2026-07-15" nên bản cũ hiện đúng nguyên chuỗi ISO
                   * ra màn hình — trái `D-12` (`dd/MM/yyyy`). Không ai thấy vì
                   * seed **không có hóa đơn nào**, bảng luôn rỗng.
                   */}
                  <DataTableCell>{formatDateOnly(row.issue_date)}</DataTableCell>
                  <DataTableCell>
                    {row.student?.student_code} — {row.student?.full_name}
                  </DataTableCell>
                  <DataTableCell>{row.class?.code ?? "—"}</DataTableCell>
                  <DataTableCell>
                    {row.status && (
                      <StatusBadge
                        tone={INVOICE_STATUS_TONE[row.status]}
                        label={INVOICE_STATUS_LABELS[row.status]}
                      />
                    )}
                  </DataTableCell>
                  <DataTableCell numeric>{money.format(row.total)}</DataTableCell>
                  <DataTableCell numeric>
                    {money.format(row.paid_amount)}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {money.format(row.balance)}
                  </DataTableCell>
                </DataTableRow>
              ))}
              {report.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-text-secondary px-4 py-12 text-center"
                  >
                    Không có hóa đơn phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="h-full gap-1 py-3">
      <CardContent className="px-4">
        {/* `<dl>` nằm TRONG thẻ: bọc `<dl>` ra ngoài các `Card` thì `<dt>` sâu
            hai cấp so với `<dl>` và axe báo `definition-list`/`dlitem`. */}
        <dl>
          <dt className="text-text-secondary text-sm">{label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
