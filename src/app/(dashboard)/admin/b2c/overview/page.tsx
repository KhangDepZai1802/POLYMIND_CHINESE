import { CustomerSourceCard } from "@/features/b2c/components/customer-source-card";
import { ClassOccupancyProgress } from "@/features/b2c/components/class-occupancy-progress";
import { LowEnrollmentCard } from "@/features/b2c/components/low-enrollment-card";
import { isLowEnrollment } from "@/features/b2c/domain/class-enrollment-warning";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpen, School, TrendingUp, Users } from "lucide-react";

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
import {
  getB2COverview,
  getB2CCustomerSourceOverview,
} from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/dates";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function B2COverviewPage() {
  const [user, overview, customerSources] = await Promise.all([
    requireManager(),
    getB2COverview(),
    getB2CCustomerSourceOverview(),
  ]);
  const report = overview.latestReport;
  const lowEnrollmentClasses = overview.classes
    .filter((item) => isLowEnrollment(item.actualEnrollmentCount, item.status))
    .sort((a, b) => a.actualEnrollmentCount - b.actualEnrollmentCount);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Tổng quan hoạt động lớp trung tâm. Số liệu được tách riêng hoàn toàn với các lớp doanh nghiệp."
        action={<Link href="/admin/b2c/today" className="text-primary text-sm font-medium hover:underline">Mở việc cần xử lý hôm nay →</Link>}
      />

      <section aria-labelledby="b2c-kpi-heading">
        <h2 id="b2c-kpi-heading" className="sr-only">
          Số liệu tổng quan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            icon={Users}
            cardClassName="border-teal-200 bg-linear-to-br from-teal-50 to-white dark:border-teal-900 dark:from-teal-950/60 dark:to-card"
            iconClassName="bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
            label="Học viên"
            value={overview.studentCount}
            hint={`${overview.enrollmentCount} lượt ghi danh`}
            href="/admin/b2c/students"
          />
          <Stat
            icon={School}
            cardClassName="border-blue-200 bg-linear-to-br from-blue-50 to-white dark:border-blue-900 dark:from-blue-950/60 dark:to-card"
            label="Lớp đang hoạt động"
            value={overview.activeClassCount}
            hint="Đang tổ chức giảng dạy"
            href="/admin/b2c"
          />
          <Stat
            icon={BookOpen}
            cardClassName="border-violet-200 bg-linear-to-br from-violet-50 to-white dark:border-violet-900 dark:from-violet-950/60 dark:to-card"
            iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
            label="Nhóm đang có lớp"
            value={overview.programCount}
            hint="Trong 5 nhóm chương trình"
            href="/admin/b2c"
          />
          <Stat
            icon={TrendingUp}
            cardClassName="border-emerald-200 bg-linear-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/60 dark:to-card"
            iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            label="Doanh thu gần nhất"
            value={report ? formatCurrency(report.revenue) : "—"}
            hint={
              report
                ? `Tháng ${report.report_month}/${report.report_year}`
                : "Chưa có báo cáo tháng"
            }
            href="/admin/b2c/reports"
          />
          <LowEnrollmentCard classes={lowEnrollmentClasses} />
        </div>
      </section>

      <Card className="mt-4 gap-4 border-amber-200 bg-linear-to-br from-amber-50/80 to-card py-4 dark:border-amber-900 dark:from-amber-950/30">
        <CardHeader className="px-4">
          <CardTitle asChild className="text-base">
            <h2>Điểm hòa vốn ước tính</h2>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {report
              ? `Theo báo cáo tháng ${report.report_month}/${report.report_year}`
              : "Chưa có báo cáo tháng"}
          </p>
        </CardHeader>
        <CardContent className="px-4">
          {overview.breakEven?.requiredStudents != null ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-sm">
                    HV cần để hòa vốn
                  </p>
                  <p className="mt-1 text-3xl font-bold">
                    {overview.breakEven.requiredStudents.toLocaleString(
                      "vi-VN",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    HV cuối tháng theo báo cáo
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {overview.breakEven.currentStudents?.toLocaleString(
                      "vi-VN",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Cần thêm để hòa vốn
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {overview.breakEven.shortfall?.toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Doanh thu bình quân{" "}
                {formatCurrency(overview.breakEven.revenuePerStudent ?? 0)}/HV;
                chi phí GV bình quân{" "}
                {formatCurrency(overview.breakEven.variableCostPerStudent ?? 0)}
                /HV; chi phí cố định{" "}
                {formatCurrency(overview.breakEven.fixedCost ?? 0)}.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {overview.breakEven?.reason ??
                "Nhập báo cáo tháng để tính số học viên hòa vốn."}
            </p>
          )}
          <details className="text-muted-foreground mt-3 text-xs">
            <summary className="cursor-pointer">Giả định và cách tính</summary>
            <p className="mt-2">
              Số HV hòa vốn = làm tròn lên [chi phí cố định / (doanh thu bình
              quân mỗi HV − chi phí GV bình quân mỗi HV)]. Ước tính coi toàn bộ
              lương GV là chi phí biến đổi, các khoản còn lại là chi phí cố định
              và cơ cấu lớp/học phí không đổi. Số HV lấy tổng cuối tháng các
              chương trình trong báo cáo, có thể gồm một người học nhiều chương
              trình; không phải số hồ sơ duy nhất hiện tại. Chưa xét giới hạn
              phòng, mở thêm lớp hay thay đổi đơn giá.
            </p>
          </details>
          <Link
            href="/admin/b2c/reports"
            className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
          >
            Nhập / sửa báo cáo tháng
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-4 gap-4 border-sky-200 bg-linear-to-br from-sky-50/60 to-card py-4 dark:border-sky-900 dark:from-sky-950/20">
        <CardHeader className="px-4">
          <CardTitle asChild className="text-base">
            <h2 className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </span>
              <span>Nguồn khách</span>
            </h2>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {customerSources.total.toLocaleString("vi-VN")} học viên · Mỗi học
            viên tính một lần, dù học nhiều lớp.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 sm:grid-cols-2 xl:grid-cols-4">
          {customerSources.rows.map((row) => {
            const percent = customerSources.total
              ? (row.count / customerSources.total) * 100
              : 0;
            const sourceColorMap: Record<string, string> = {
              facebook: "bg-blue-600",
              zalo: "bg-sky-500",
              tiktok: "bg-neutral-800 dark:bg-neutral-200",
              referral: "bg-violet-500",
              walk_in: "bg-amber-500",
              school: "bg-emerald-500",
              other: "bg-rose-500",
              unknown: "bg-slate-400",
            };
            const sourceSurfaceMap: Record<string, string> = {
              facebook: "border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30",
              zalo: "border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30",
              tiktok: "border-slate-300 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/50",
              referral: "border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30",
              walk_in: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30",
              school: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30",
              other: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
              unknown: "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40",
            };
            return (
              <CustomerSourceCard
                key={row.source ?? "unknown"}
                source={row.source}
                label={row.label}
                count={row.count}
                percent={percent}
                color={sourceColorMap[row.source ?? "unknown"] ?? "bg-slate-400"}
                className={sourceSurfaceMap[row.source ?? "unknown"] ?? sourceSurfaceMap.unknown}
              />
            );
          })}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)]">
        <Card className="min-w-0 gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle asChild className="text-base">
              <h2>Tổng hợp theo chương trình</h2>
            </CardTitle>
            <p className="text-text-secondary mt-1 text-sm">
              Số lớp, lượt ghi danh và sức chứa của từng nhóm.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              caption="Tổng hợp hoạt động theo nhóm chương trình"
              minWidthClass="min-w-[34rem]"
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead sticky>Chương trình</DataTableHead>
                  <DataTableHead numeric>Lớp hoạt động</DataTableHead>
                  <DataTableHead numeric>Tổng số lớp</DataTableHead>
                  <DataTableHead numeric>Ghi danh</DataTableHead>
                  <DataTableHead numeric>Sức chứa</DataTableHead>
                  <DataTableHead>Tỷ lệ lấp đầy</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {overview.programs.map((program) => (
                  <DataTableRow key={program.slug}>
                    <DataTableCell sticky>
                      <Link
                        href={`/admin/b2c/${program.slug}`}
                        className="focus-visible:ring-ring inline-flex items-center gap-2 rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${program.slug === "tieng-anh" ? "bg-blue-500" : program.slug === "tieng-trung" ? "bg-amber-500" : program.slug === "tieng-viet" ? "bg-emerald-500" : program.slug === "lop-ve" ? "bg-violet-500" : "bg-pink-500"}`} />
                        {program.title}
                      </Link>
                    </DataTableCell>
                    <DataTableCell numeric>
                      {program.activeClassCount}
                    </DataTableCell>
                    <DataTableCell numeric>{program.classCount}</DataTableCell>
                    <DataTableCell numeric>
                      {program.enrollmentCount}
                    </DataTableCell>
                    <DataTableCell numeric>{program.capacity}</DataTableCell>
                    <DataTableCell><ProgramOccupancy count={program.enrollmentCount} capacity={program.capacity} name={program.title} slug={program.slug} /></DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-4 bg-linear-to-br from-emerald-50/80 to-card py-4 dark:from-emerald-950/20">
          <CardHeader className="px-4">
            <CardTitle asChild className="text-base">
              <h2>Kết quả tháng gần nhất</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {report ? (
              <dl className="space-y-3">
                <Metric
                  label="Kỳ báo cáo"
                  value={`Tháng ${report.report_month}/${report.report_year}`}
                />
                <Metric
                  label="Doanh thu"
                  value={formatCurrency(report.revenue)}
                />
                <Metric
                  label="Tổng chi phí"
                  value={formatCurrency(report.totalCost)}
                />
                <Metric
                  label="Chênh lệch"
                  value={formatCurrency(report.balance)}
                  emphasized
                />
              </dl>
            ) : (
              <p className="text-text-secondary text-sm">
                Chưa có báo cáo tháng để tổng hợp.
              </p>
            )}
            <Link
              href="/admin/b2c/reports"
              className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              <BarChart3 className="size-4" aria-hidden />
              Xem báo cáo
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-4 bg-linear-to-br from-blue-50/60 to-card py-4 dark:from-blue-950/20">
        <CardHeader className="px-4">
          <CardTitle asChild className="text-base">
            <h2>Các lớp đang hoạt động</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            caption="Danh sách lớp đang hoạt động"
            minWidthClass="min-w-[46rem]"
          >
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
                      {[item.weekdays_text, item.time_text]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </DataTableCell>
                    <DataTableCell numeric>
                      {item.actualEnrollmentCount}/{item.capacity}
                      <ClassOccupancyProgress count={item.actualEnrollmentCount} capacity={item.capacity} />
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

function ProgramOccupancy({ count, capacity, name, slug }: { count: number; capacity: number; name: string; slug: string }) {
  if (capacity <= 0) return <span className="text-muted-foreground text-xs">Chưa có sức chứa</span>;
  const percent = count / capacity * 100;
  const color = slug === "tieng-viet" ? "from-emerald-500 to-teal-400" : slug === "lop-ve" || slug === "kem-1-1" ? "from-pink-500 to-fuchsia-400" : "from-blue-500 to-sky-400";
  return <div className="flex min-w-36 items-center gap-3"><span role="progressbar" aria-label={`Tỷ lệ lấp đầy ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-valuetext={`${percent.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%`} className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className={`block h-full rounded-full bg-linear-to-r ${color}`} style={{ width: `${Math.min(100, percent)}%` }} /></span><span className="min-w-9 text-right text-xs tabular-nums">{percent.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%</span></div>;
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
  cardClassName = "",
  iconClassName = "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  hint: string;
  href: string;
  iconClassName?: string;
  cardClassName?: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className={`hover:border-primary/40 h-full py-0 transition-colors hover:shadow-md ${cardClassName}`}>
        <CardContent className="flex items-start gap-3 p-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xl leading-tight font-semibold tabular-nums">
              {value}
            </p>
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
      <dd
        className={
          emphasized
            ? "text-primary font-semibold tabular-nums"
            : "font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
