import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  GraduationCap,
  School,
  UserCheck,
  Users,
} from "lucide-react";

import {
  getAdminOverview,
  getAtRiskStudents,
  getClassProgress,
  getSessionsToday,
  getTuitionSummary,
} from "@/features/dashboard/server/queries";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatPercent, formatTime } from "@/lib/dates";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function AdminDashboardPage() {
  const [user, overview, sessionsToday, classProgress, atRisk, tuition] =
    await Promise.all([
      requireRole("super_admin"),
      getAdminOverview(),
      getSessionsToday(),
      getClassProgress(),
      getAtRiskStudents(),
      getTuitionSummary(),
    ]);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Tổng quan toàn trung tâm. Mọi con số lấy trực tiếp từ dữ liệu thật."
      />

      {/*
       * `min-w-0` trên CHÍNH các con của grid, không phải trên lớp bọc: con grid
       * mặc định `min-width: auto` nên không co được dưới bề rộng min-content —
       * đúng nguyên nhân `DS-039`, đo được trang này tràn 127px @360 trước khi sửa.
       */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Số liệu tổng quan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={Users}
            label="Học viên đang học"
            value={overview.openEnrollments}
            hint="Ghi danh đang mở"
            href="/admin/students"
          />
          <Stat
            icon={School}
            label="Lớp đang hoạt động"
            value={overview.activeClasses}
            hint={`${overview.activeCourses} khóa học đang mở`}
            href="/admin/classes"
          />
          <Stat
            icon={CalendarDays}
            label="Buổi học hôm nay"
            value={overview.sessionsToday}
            hint="Theo giờ Việt Nam"
            href="/admin/schedule"
          />
          <Stat
            icon={GraduationCap}
            label="Giáo viên"
            value={overview.activeTeachers}
            hint="Đang hoạt động"
            href="/admin/teachers"
          />
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.72fr)]">
        <div className="min-w-0 space-y-4">
          {/* --- Tiến độ lớp --- */}
          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2>Tiến độ các lớp</h2>
              </CardTitle>
              <p className="text-text-secondary mt-1 text-sm">
                Chuyên cần và tiến độ do hệ thống tính từ dữ liệu thật, không
                phải số nhập tay.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {classProgress.length === 0 ? (
                <EmptyState
                  icon={School}
                  title="Chưa có lớp nào đang mở"
                  description="Mở lớp ở mục Lớp học."
                />
              ) : (
                <DataTable
                  caption="Tiến độ các lớp đang mở: sĩ số, chuyên cần và tiến độ trung bình"
                  minWidthClass="min-w-[34rem]"
                >
                  <DataTableHeader>
                    <tr>
                      <DataTableHead sticky>Lớp</DataTableHead>
                      <DataTableHead numeric>Sĩ số</DataTableHead>
                      <DataTableHead numeric>Chuyên cần</DataTableHead>
                      <DataTableHead numeric>Tiến độ</DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {classProgress.map((c) => (
                      <DataTableRow key={c.class_id}>
                        <DataTableCell sticky>
                          <Link
                            href={`/admin/classes/${c.class_id}`}
                            className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <span className="font-mono text-sm">
                              {c.class_code}
                            </span>
                            <span className="ml-2">{c.class_name}</span>
                          </Link>
                          {c.status && (
                            <StatusBadge
                              className="ml-2"
                              label={CLASS_STATUS_LABELS[c.status]}
                              tone={CLASS_STATUS_TONE[c.status]}
                            />
                          )}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {c.active_students ?? 0}/{c.capacity ?? "—"}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {formatPercent(c.avg_attendance_rate)}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {formatPercent(c.avg_progress_percent)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </CardContent>
          </Card>

          {/* --- Học viên cần chú ý --- */}
          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2 className="flex items-center gap-2">
                  <AlertTriangle className="text-warning size-4" aria-hidden />
                  Học viên cần chú ý ({overview.atRiskCount})
                </h2>
              </CardTitle>
              <p className="text-text-secondary mt-1 text-sm">
                Hệ thống chỉ <strong>cảnh báo</strong>; quyết định vẫn là của
                người.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {atRisk.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="Không có học viên nào cần chú ý"
                  description="Chuyên cần, điểm và bài tập đều đạt ngưỡng của khóa học."
                />
              ) : (
                <ul className="divide-y border-t">
                  {atRisk.map((s) => (
                    <li
                      key={s.enrollment_id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.full_name}</p>
                        {/*
                         * `text-sm` chứ không `text-xs`: mã học viên và tên lớp
                         * là thứ dùng để TÌM ĐÚNG NGƯỜI khi gọi điện, không phải
                         * chú thích trang trí (cùng lỗi đã sửa ở M25/M26/M27).
                         */}
                        <p className="text-text-secondary text-sm">
                          {s.student_code} · {s.class_name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {(s.risk_reasons ?? []).map((r) => (
                          <StatusBadge key={r} label={r} tone="warning" />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {/* --- Buổi học hôm nay --- */}
          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2>Buổi học hôm nay</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessionsToday.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Hôm nay không có buổi học"
                  description="Xem toàn bộ lịch ở mục Lịch học."
                />
              ) : (
                <ul className="divide-y border-t">
                  {sessionsToday.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-text-secondary w-24 shrink-0 text-sm tabular-nums">
                        {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.class?.code} · Buổi {s.session_number}
                        </p>
                        <p className="text-text-secondary truncate text-sm">
                          {s.topic ?? s.class?.name}
                        </p>
                      </div>
                      <StatusBadge
                        label={SESSION_STATUS_LABELS[s.status]}
                        tone={SESSION_STATUS_TONE[s.status]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Học phí --- */}
          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2>Học phí</h2>
              </CardTitle>
              <p className="text-text-secondary mt-1 text-sm">
                “Còn phải thu” là số dư hóa đơn, <strong>không</strong> phải
                module công nợ.
              </p>
            </CardHeader>
            <CardContent className="px-4">
              {/*
               * `<dl>` thật: mỗi con số là một cặp nhãn–giá trị, không phải hai
               * dòng chữ rời nhau (cùng cách đã làm ở M26).
               *
               * Bố cục bằng grid ĐẶT TRÊN CHÍNH `<dl>`, không bọc thêm một lớp
               * `<div>` để xếp hàng ngang: `<dl>` chỉ được chứa trực tiếp
               * `<dt>`/`<dd>` hoặc `<div>` bọc **một** cặp. Bản đầu của đợt này
               * lồng hai cấp `<div>` và axe bắt đúng hai lỗi `serious`
               * (`definition-list` + `dlitem` 4 node) — sửa trước khi giao.
               */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="col-span-2">
                  <dt className="text-text-secondary text-sm">Còn phải thu</dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(tuition.outstanding)}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary text-sm">Hóa đơn</dt>
                  <dd className="font-medium tabular-nums">
                    {tuition.invoiceCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary text-sm">Quá hạn</dt>
                  <dd className="text-danger-ink font-medium tabular-nums">
                    {tuition.overdueCount}
                  </dd>
                </div>
              </dl>
              {tuition.invoiceCount === 0 && (
                <p className="text-text-secondary mt-3 text-sm">
                  Chưa có hóa đơn nào. Module học phí sẽ mở ở Phase 6.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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
  value: number;
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
