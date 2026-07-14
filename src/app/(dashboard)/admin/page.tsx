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
  const user = await requireRole("super_admin");

  const [overview, sessionsToday, classProgress, atRisk, tuition] =
    await Promise.all([
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <div className="space-y-5">
          {/* --- Tiến độ lớp --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tiến độ các lớp</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-t border-b text-xs">
                      <tr>
                        <th className="px-5 py-2 text-left font-medium">Lớp</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Sĩ số
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Chuyên cần
                        </th>
                        <th className="px-5 py-2 text-right font-medium">
                          Tiến độ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {classProgress.map((c) => (
                        <tr key={c.class_id} className="hover:bg-muted/40">
                          <td className="px-5 py-3">
                            <Link
                              href={`/admin/classes/${c.class_id}`}
                              className="hover:underline"
                            >
                              <span className="font-mono text-xs">
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
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {c.active_students ?? 0}/{c.capacity ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatPercent(c.avg_attendance_rate)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatPercent(c.avg_progress_percent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* --- Học viên cần chú ý --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="text-warning size-4" aria-hidden />
                Học viên cần chú ý ({overview.atRiskCount})
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
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
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.full_name}</p>
                        <p className="text-muted-foreground text-xs">
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

        <div className="space-y-5">
          {/* --- Buổi học hôm nay --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buổi học hôm nay</CardTitle>
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
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
                        {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.class?.code} · Buổi {s.session_number}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Học phí</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                “Còn phải thu” là số dư hóa đơn, <strong>không</strong> phải
                module công nợ.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Còn phải thu</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(tuition.outstanding)}
                </p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-muted-foreground text-xs">Hóa đơn</p>
                  <p className="font-medium tabular-nums">
                    {tuition.invoiceCount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Quá hạn</p>
                  <p className="text-destructive font-medium tabular-nums">
                    {tuition.overdueCount}
                  </p>
                </div>
              </div>
              {tuition.invoiceCount === 0 && (
                <p className="text-muted-foreground text-xs">
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
    <Link href={href}>
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardContent className="flex items-start gap-3 p-5">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-muted-foreground text-xs">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
