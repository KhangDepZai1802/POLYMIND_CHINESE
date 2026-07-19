import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClassOptions } from "@/features/classes/server/queries";
import { getTeacherClassReport } from "@/features/reports/server/teacher-queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { requireRole } from "@/lib/auth/session";
import { formatPercent, formatScore } from "@/lib/dates";
import { formatAttendanceScore } from "@/lib/domain/attendance";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  ENROLLMENT_STATUS_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Báo cáo lớp" };

export default async function TeacherProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole("teacher");
  const { class: requestedClassId } = await searchParams;

  // RLS khoanh về `class_teachers`; không tự lọc thêm ở app.
  const classes = await getClassOptions();
  const selected =
    classes.find((item) => item.id === requestedClassId) ?? classes[0];

  const report = selected ? await getTeacherClassReport(selected.id) : null;

  return (
    <>
      <PageHeader
        title="Báo cáo lớp"
        description="Chuyên cần, tiến độ và điểm — do hệ thống tính từ dữ liệu thật, không phải số nhập tay."
      />

      <div className="mb-5">
        <ClassPicker
          classes={classes}
          selectedId={selected?.id}
          basePath="/teacher/progress"
          placeholder="Chọn lớp để xem báo cáo"
        />
      </div>

      {!selected || !report ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={TrendingUp}
              title="Bạn chưa có lớp để xem báo cáo"
              description="Khi được quản trị viên phân công lớp, báo cáo chuyên cần và tiến độ sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">
              {selected.code}
            </span>
            <StatusBadge
              label={CLASS_STATUS_LABELS[selected.status]}
              tone={CLASS_STATUS_TONE[selected.status]}
            />
            <span className="text-muted-foreground text-sm">
              {selected.name}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={Users}
              label="Học viên đang học"
              value={report.summary?.active_students ?? 0}
              hint={`${report.summary?.completed_students ?? 0} đã hoàn thành`}
            />
            <Stat
              icon={CalendarCheck}
              label="Tỉ lệ chuyên cần TB"
              value={formatPercent(report.summary?.avg_attendance_rate)}
              hint="Trên các buổi đã điểm danh"
            />
            <Stat
              icon={ClipboardList}
              label="Điểm TB"
              value={
                report.summary?.avg_score === null ||
                report.summary?.avg_score === undefined
                  ? "—"
                  : formatScore(report.summary.avg_score)
              }
              hint="Từ kết quả đã chấm"
            />
            <Stat
              icon={BookOpen}
              label="Tiến độ TB"
              value={formatPercent(report.summary?.avg_progress_percent)}
              hint="Bài học đã hoàn thành"
            />
          </div>

          {report.atRisk.length > 0 && (
            <Card className="border-warning/40 bg-warning/5 mt-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="text-warning size-4" aria-hidden />
                  Học viên cần chú ý ({report.atRisk.length})
                </CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ngưỡng cảnh báo do hệ thống tính; xem lý do cụ thể từng em.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {report.atRisk.map((student) => (
                    <li
                      key={student.enrollment_id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {student.full_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {student.student_code} · Tỉ lệ chuyên cần{" "}
                          {formatPercent(student.attendance_rate)} · Tiến độ{" "}
                          {formatPercent(student.progress_percent)}
                          {student.missing_exercises
                            ? ` · Thiếu ${student.missing_exercises} bài`
                            : ""}
                        </p>
                        {student.risk_reasons && (
                          <p className="text-warning mt-1 text-xs">
                            {Array.isArray(student.risk_reasons)
                              ? student.risk_reasons.join(" · ")
                              : String(student.risk_reasons)}
                          </p>
                        )}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/teacher/evaluations/${student.enrollment_id}`}
                        >
                          Ghi nhận xét
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-base">Chi tiết từng học viên</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Học viên đã rút hoặc chuyển lớp không nằm trong báo cáo — giữ mẫu
                số chuyên cần đúng.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {report.rows.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Lớp chưa có học viên đang học"
                  description="Ghi danh học viên vào lớp để bắt đầu theo dõi tiến độ."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b text-left text-xs">
                      <tr>
                        <th className="px-5 py-2 font-medium">Học viên</th>
                        <th className="px-3 py-2 font-medium">
                          Điểm chuyên cần
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Có mặt / Muộn / Vắng
                        </th>
                        <th className="px-3 py-2 font-medium">Bài đã nộp</th>
                        <th className="px-3 py-2 font-medium">Điểm TB</th>
                        <th className="px-3 py-2 font-medium">Tiến độ</th>
                        <th className="px-5 py-2 font-medium">Hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.rows.map((row) => (
                        <tr key={row.enrollmentId}>
                          <td className="px-5 py-3">
                            <Link
                              href={`/teacher/evaluations/${row.enrollmentId}`}
                              className="font-medium hover:underline"
                            >
                              {row.student?.full_name ?? "Học viên"}
                            </Link>
                            <p className="text-muted-foreground text-xs">
                              {row.student?.student_code} ·{" "}
                              {ENROLLMENT_STATUS_LABELS[row.status]}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {formatAttendanceScore(
                              row.attendance?.absent_count,
                            )}
                            /10
                          </td>
                          <td className="text-muted-foreground px-3 py-3 text-xs">
                            {row.attendance?.present_count ?? 0} /{" "}
                            {row.attendance?.late_count ?? 0} /{" "}
                            {row.attendance?.absent_count ?? 0}
                          </td>
                          <td className="px-3 py-3">
                            {row.progress?.submitted_exercises ?? 0}/
                            {row.progress?.total_exercises ?? 0}
                          </td>
                          <td className="px-3 py-3">
                            {row.progress?.avg_score === null ||
                            row.progress?.avg_score === undefined
                              ? "—"
                              : formatScore(row.progress.avg_score)}
                          </td>
                          <td className="px-3 py-3">
                            {formatPercent(row.progress?.progress_percent)}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge
                              label={
                                row.progress?.is_completion_ready
                                  ? "Đủ điều kiện"
                                  : "Chưa đủ"
                              }
                              tone={
                                row.progress?.is_completion_ready
                                  ? "success"
                                  : "neutral"
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="mt-0.5 text-xl font-semibold">{value}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
