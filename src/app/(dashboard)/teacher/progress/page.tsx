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
import { AttendanceBars } from "@/features/reports/components/attendance-bars";
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

  /*
   * Cờ "cần chú ý" của biểu đồ lấy thẳng từ view `v_at_risk_assessment_students`
   * mà query đã trả về — KHÔNG tự đặt ngưỡng chuyên cần mới ở tầng UI. Đặt
   * ngưỡng riêng ở đây là tạo nguồn sự thật thứ hai về "thế nào là đuối".
   */
  const atRiskEnrollmentIds = new Set(
    (report?.atRisk ?? []).map((student) => student.enrollment_id),
  );

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
            <span className="font-mono text-sm font-semibold">
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

          {/*
            Biểu đồ đặt TRƯỚC khối cảnh báo: nó trả lời "ai đang đuối nhất" cho
            cả lớp, còn khối dưới mới là danh sách do DB đánh dấu.
          */}
          <AttendanceBars
            rows={report.rows.map((row) => ({
              enrollmentId: row.enrollmentId,
              fullName: row.student?.full_name ?? "Học viên",
              // View trả `numeric` → PostgREST có thể đưa về chuỗi; ép số ở đây
              // để phép sắp xếp không so sánh chuỗi ("100" < "9").
              attendanceRate:
                row.attendance?.attendance_rate === null ||
                row.attendance?.attendance_rate === undefined
                  ? null
                  : Number(row.attendance.attendance_rate),
              atRisk: atRiskEnrollmentIds.has(row.enrollmentId),
            }))}
          />

          {report.atRisk.length > 0 && (
            <Card className="border-warning/40 bg-warning/5 mt-5">
              <CardHeader>
                <CardTitle asChild className="text-base">
                  <h2 className="flex items-center gap-2">
                    <AlertTriangle
                      className="text-warning size-4 shrink-0"
                      aria-hidden
                    />
                    Học viên cần chú ý ({report.atRisk.length})
                  </h2>
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
                        {/*
                          Đây là số liệu để giáo viên QUYẾT ĐỊNH can thiệp, không
                          phải chú thích trang trí — không để ở 12px.
                        */}
                        <p className="text-muted-foreground text-sm tabular-nums">
                          {student.student_code} · Tỉ lệ chuyên cần{" "}
                          {formatPercent(student.attendance_rate)} · Tiến độ{" "}
                          {formatPercent(student.progress_percent)}
                          {student.missing_exercises
                            ? ` · Thiếu ${student.missing_exercises} bài`
                            : ""}
                        </p>
                        {student.risk_reasons && (
                          <p className="text-warning mt-1 text-sm">
                            {Array.isArray(student.risk_reasons)
                              ? student.risk_reasons.join(" · ")
                              : String(student.risk_reasons)}
                          </p>
                        )}
                      </div>
                      {/*
                        Cả khối có N nút cùng chữ "Ghi nhận xét". Tên gọi được
                        kèm tên học viên, vẫn chứa nguyên chữ nhìn thấy nên không
                        phạm WCAG 2.5.3 (cùng cách M18 đã làm).
                      */}
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/teacher/evaluations/${student.enrollment_id}`}
                          aria-label={`Ghi nhận xét ${student.full_name}`}
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
              <CardTitle asChild className="text-base">
                <h2>Chi tiết từng học viên</h2>
              </CardTitle>
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
                // Vùng cuộn ngang phải focus được, nếu không người dùng bàn phím
                // không bao giờ tới được ba cột bên phải ở 360px — đúng lỗi
                // `UX-UIUX-M21-009` đã sửa ở màn học viên.
                <div
                  data-slot="table-scroller"
                  role="region"
                  aria-label="Bảng chi tiết từng học viên, cuộn ngang để xem đủ cột"
                  tabIndex={0}
                  className="focus-visible:ring-ring overflow-x-auto focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/*
                    `min-w` chứ không để `w-full` co lại: 7 cột nhồi vào 360px
                    thì mỗi cột còn ~51px, tiêu đề "Có mặt / Muộn / Vắng" vỡ
                    thành ba dòng và bảng tuy KHÔNG tràn nhưng đọc không nổi.
                    Cho nó cuộn ngang là hành vi đúng cho bảng số liệu 7 cột —
                    và cũng là lý do vùng bọc cần focus được.
                  */}
                  <table className="w-full min-w-176 text-sm">
                    <caption className="sr-only">
                      Chuyên cần, bài đã nộp, điểm trung bình và tiến độ của
                      từng học viên đang học trong lớp.
                    </caption>
                    <thead className="text-muted-foreground border-b text-left text-sm">
                      <tr>
                        <th scope="col" className="px-5 py-2 font-medium">
                          Học viên
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Điểm chuyên cần
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Có mặt / Muộn / Vắng
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Bài đã nộp
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Điểm TB
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Tiến độ
                        </th>
                        <th scope="col" className="px-5 py-2 font-medium">
                          Hoàn thành
                        </th>
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
                            <p className="text-muted-foreground text-sm">
                              {row.student?.student_code} ·{" "}
                              {ENROLLMENT_STATUS_LABELS[row.status]}
                            </p>
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {formatAttendanceScore(
                              row.attendance?.absent_count,
                            )}
                            /10
                          </td>
                          <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">
                            {row.attendance?.present_count ?? 0} /{" "}
                            {row.attendance?.late_count ?? 0} /{" "}
                            {row.attendance?.absent_count ?? 0}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {row.progress?.submitted_exercises ?? 0}/
                            {row.progress?.total_exercises ?? 0}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {row.progress?.avg_score === null ||
                            row.progress?.avg_score === undefined
                              ? "—"
                              : formatScore(row.progress.avg_score)}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
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
          <p className="text-muted-foreground text-sm">{label}</p>
          {/* `tabular-nums` để bốn ô số liệu không nhảy chiều rộng khi đổi lớp. */}
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
