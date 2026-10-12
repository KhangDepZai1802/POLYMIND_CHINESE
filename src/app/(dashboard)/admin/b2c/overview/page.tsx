import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  School,
  TrendingUp,
  Users,
} from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getB2COverview } from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/dates";

export const metadata: Metadata = { title: "Tổng quan B2C" };

export default async function B2COverviewPage() {
  const [user, overview] = await Promise.all([
    requireManager(),
    getB2COverview(),
  ]);
  const report = overview.latestReport;

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Tổng quan hoạt động lớp trung tâm (B2C). Số liệu được tách riêng hoàn toàn với các lớp doanh nghiệp."
      />

      <section aria-labelledby="b2c-kpi-heading">
        <h2 id="b2c-kpi-heading" className="sr-only">
          Số liệu tổng quan B2C
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={Users}
            label="Học viên B2C"
            value={overview.studentCount}
            hint={`${overview.enrollmentCount} lượt ghi danh`}
            href="/admin/b2c/students"
          />
          <Stat
            icon={School}
            label="Lớp đang hoạt động"
            value={overview.activeClassCount}
            hint="Chỉ tính lớp B2C"
            href="/admin/b2c"
          />
          <Stat
            icon={BookOpen}
            label="Nhóm đang có lớp"
            value={overview.programCount}
            hint="Trong 5 nhóm chương trình"
            href="/admin/b2c"
          />
          <Stat
            icon={TrendingUp}
            label="Doanh thu gần nhất"
            value={report ? formatCurrency(report.revenue) : "—"}
            hint={
              report
                ? `Tháng ${report.report_month}/${report.report_year}`
                : "Chưa có báo cáo tháng"
            }
            href="/admin/b2c/reports"
          />
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)]">
        <Card className="min-w-0 gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle asChild className="text-base">
              <h2>Tổng hợp theo chương trình</h2>
            </CardTitle>
            <p className="text-text-secondary mt-1 text-sm">
              Số lớp, lượt ghi danh và sức chứa của từng nhóm B2C.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              caption="Tổng hợp hoạt động theo nhóm chương trình B2C"
              minWidthClass="min-w-[34rem]"
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead sticky>Chương trình</DataTableHead>
                  <DataTableHead numeric>Lớp hoạt động</DataTableHead>
                  <DataTableHead numeric>Tổng số lớp</DataTableHead>
                  <DataTableHead numeric>Ghi danh</DataTableHead>
                  <DataTableHead numeric>Sức chứa</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {overview.programs.map((program) => (
                  <DataTableRow key={program.slug}>
                    <DataTableCell sticky>
                      <Link
                        href={`/admin/b2c/${program.slug}`}
                        className="focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {program.title}
                      </Link>
                    </DataTableCell>
                    <DataTableCell numeric>{program.activeClassCount}</DataTableCell>
                    <DataTableCell numeric>{program.classCount}</DataTableCell>
                    <DataTableCell numeric>{program.enrollmentCount}</DataTableCell>
                    <DataTableCell numeric>{program.capacity}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle asChild className="text-base">
              <h2>Kết quả tháng gần nhất</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {report ? (
              <dl className="space-y-3">
                <Metric label="Kỳ báo cáo" value={`Tháng ${report.report_month}/${report.report_year}`} />
                <Metric label="Doanh thu" value={formatCurrency(report.revenue)} />
                <Metric label="Tổng chi phí" value={formatCurrency(report.totalCost)} />
                <Metric
                  label="Chênh lệch"
                  value={formatCurrency(report.balance)}
                  emphasized
                />
              </dl>
            ) : (
              <p className="text-text-secondary text-sm">
                Chưa có báo cáo tháng B2C để tổng hợp.
              </p>
            )}
            <Link
              href="/admin/b2c/reports"
              className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              <BarChart3 className="size-4" aria-hidden />
              Xem báo cáo B2C
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle asChild className="text-base">
            <h2>Các lớp B2C đang hoạt động</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable caption="Danh sách lớp B2C đang hoạt động" minWidthClass="min-w-[46rem]">
            <DataTableHeader>
              <tr>
                <DataTableHead sticky>Lớp</DataTableHead>
                <DataTableHead>Giáo viên</DataTableHead>
                <DataTableHead>Lịch học</DataTableHead>
                <DataTableHead numeric>Sĩ số</DataTableHead>
                <DataTableHead>Trạng thái</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {overview.classes
                .filter((item) => item.status === "active")
                .map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell sticky>
                      <Link
                        href={`/admin/b2c/${item.program_slug}`}
                        className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="font-mono text-sm">{item.code}</span>
                        <span className="ml-2 font-medium">{item.name}</span>
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{item.teacher_name || "—"}</DataTableCell>
                    <DataTableCell>
                      {[item.weekdays_text, item.time_text].filter(Boolean).join(" · ") || "—"}
                    </DataTableCell>
                    <DataTableCell numeric>
                      {item.actualEnrollmentCount}/{item.capacity}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge label="Đang hoạt động" tone="success" />
                    </DataTableCell>
                  </DataTableRow>
                ))}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="hover:border-primary/40 h-full py-0 transition-colors">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xl leading-tight font-semibold tabular-nums">{value}</p>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-text-secondary text-sm">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-text-secondary text-sm">{label}</dt>
      <dd className={emphasized ? "text-primary font-semibold tabular-nums" : "font-medium tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}
