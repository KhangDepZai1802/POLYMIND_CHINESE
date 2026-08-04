import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatScore } from "@/lib/dates";
import { formatAttendanceScore } from "@/lib/domain/attendance";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";
import type { Database } from "@/types/database";

import type {
  AtRiskStudent,
  getClassLearningReport,
} from "../server/learning-queries";
import { AtRiskPanel } from "./at-risk-panel";
import { AttendanceBars } from "./attendance-bars";
import { AttendanceGrid } from "./attendance-grid";
import { StatTiles } from "./stat-tiles";

type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

export type ClassLearningReportData = NonNullable<
  Awaited<ReturnType<typeof getClassLearningReport>>
>;

/**
 * Thân báo cáo một lớp (D8) — CÙNG một component cho `/admin/reports/[classId]`
 * và `/teacher/progress`; khác nhau duy nhất ở chỗ tên học viên dẫn đi đâu
 * (`studentHref`) và nút hành động ở danh sách cần chú ý (`atRiskAction`).
 * Dữ liệu tự khoanh vùng bằng RLS — component không hỏi "ai đang xem".
 */
export function ClassReportDetail({
  report,
  studentHref,
  atRiskAction,
}: {
  report: ClassLearningReportData;
  studentHref: (enrollmentId: string) => string;
  atRiskAction?: (student: AtRiskStudent) => { href: string; label: string } | null;
}) {
  const atRiskIds = new Set(
    report.atRisk.map((student) => student.enrollment_id),
  );

  return (
    <>
      <StatTiles
        tiles={[
          {
            icon: Users,
            label: "Học viên đang học",
            value: String(report.summary?.active_students ?? 0),
            hint: `${report.summary?.completed_students ?? 0} đã hoàn thành`,
          },
          {
            icon: CalendarCheck,
            label: "Tỉ lệ chuyên cần TB",
            value: formatPercent(report.summary?.avg_attendance_rate),
            hint: "Trên các buổi đã điểm danh",
          },
          {
            icon: ClipboardList,
            label: "Điểm TB",
            value:
              report.summary?.avg_score === null ||
              report.summary?.avg_score === undefined
                ? "—"
                : formatScore(report.summary.avg_score),
            hint: "Từ kết quả đã chấm",
          },
          {
            icon: BookOpen,
            label: "Tiến độ TB",
            value: formatPercent(report.summary?.avg_progress_percent),
            hint: "Bài học đã hoàn thành",
          },
        ]}
      />

      {/*
        Biểu đồ đặt TRƯỚC khối cảnh báo: nó trả lời "ai đang đuối nhất" cho cả
        lớp, còn khối dưới mới là danh sách do DB đánh dấu. (Giữ nguyên trật tự
        trang giáo viên cũ.)
      */}
      <AttendanceBars
        rows={report.rows.map((row) => ({
          enrollmentId: row.enrollmentId,
          fullName: row.student?.full_name ?? "Học viên",
          attendanceRate: row.attendance.rate,
          atRisk: atRiskIds.has(row.enrollmentId),
        }))}
      />

      <AtRiskPanel
        students={report.atRisk}
        studentHref={(student) => studentHref(student.enrollment_id)}
        action={atRiskAction}
      />

      <AttendanceGrid
        sessions={report.sessions}
        rows={report.rows.map((row) => ({
          enrollmentId: row.enrollmentId,
          name: row.student?.full_name ?? "Học viên",
          code: row.student?.student_code,
          href: studentHref(row.enrollmentId),
          summary: row.attendance,
        }))}
        cellByKey={report.cellByKey}
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle asChild className="text-base">
            <h2>Chi tiết từng học viên</h2>
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Chuyên cần và điểm tính theo kỳ đang chọn; bài đã nộp và tiến độ là
            lũy kế toàn khóa. Học viên đã rút hoặc chuyển lớp không nằm trong
            báo cáo — giữ mẫu số chuyên cần đúng.
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
            <div
              data-slot="table-scroller"
              role="region"
              aria-label="Bảng chi tiết từng học viên, cuộn ngang để xem đủ cột"
              tabIndex={0}
              className="focus-visible:ring-ring overflow-x-auto focus-visible:ring-2 focus-visible:outline-none"
            >
              <table
                data-testid="class-report-students"
                className="w-full min-w-176 text-sm"
              >
                <caption className="sr-only">
                  Chuyên cần, bài đã nộp, điểm trung bình và tiến độ của từng
                  học viên đang học trong lớp.
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
                      Điểm TB kỳ
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
                          href={studentHref(row.enrollmentId)}
                          className="font-medium hover:underline"
                        >
                          {row.student?.full_name ?? "Học viên"}
                        </Link>
                        <p className="text-muted-foreground text-sm">
                          {row.student?.student_code} ·{" "}
                          {
                            ENROLLMENT_STATUS_LABELS[
                              row.status as EnrollmentStatus
                            ]
                          }
                        </p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatAttendanceScore(row.attendance.absent)}/10
                      </td>
                      <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">
                        {row.attendance.present} / {row.attendance.late} /{" "}
                        {row.attendance.absent}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {row.progress?.submitted_exercises ?? 0}/
                        {row.progress?.total_exercises ?? 0}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {row.periodAvgScore === null
                          ? "—"
                          : formatScore(row.periodAvgScore)}
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
  );
}
