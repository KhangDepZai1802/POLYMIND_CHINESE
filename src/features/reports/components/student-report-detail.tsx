import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatPercent, formatScore } from "@/lib/dates";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_TONE,
} from "@/lib/domain/labels";

import type { getStudentLearningReport } from "../server/learning-queries";
import { StatTiles } from "./stat-tiles";

export type StudentLearningReportData = NonNullable<
  Awaited<ReturnType<typeof getStudentLearningReport>>
>;

/**
 * Thân hồ sơ học tập một học viên (US-3) — dùng chung cho admin
 * (`/admin/reports/[classId]/[enrollmentId]`) và giáo viên
 * (`/teacher/progress/[enrollmentId]`).
 *
 * Điểm TÁCH bài tập / bài kiểm tra ở tầng này (D10) — tầng trên gộp một số
 * cho gọn, xuống tới từng em thì người xem cần biết đuối ở đâu.
 */
export function StudentReportDetail({
  report,
}: {
  report: StudentLearningReportData;
}) {
  const attendanceHint = `${report.attendance.present} có mặt · ${report.attendance.late} muộn · ${report.attendance.absent} vắng${
    report.attendance.excused ? ` · ${report.attendance.excused} có phép` : ""
  }`;

  return (
    <>
      <StatTiles
        tiles={[
          {
            icon: CalendarCheck,
            label: "Chuyên cần trong kỳ",
            value:
              report.attendance.rate === null
                ? "—"
                : formatPercent(report.attendance.rate),
            hint: attendanceHint,
          },
          {
            icon: ClipboardList,
            label: "Điểm bài tập TB",
            value:
              report.avgExerciseScore === null
                ? "—"
                : formatScore(report.avgExerciseScore),
            hint: "Bài trong kỳ, đã chấm và công bố",
          },
          {
            icon: FileSpreadsheet,
            label: "Điểm kiểm tra TB",
            value:
              report.avgExamScore === null
                ? "—"
                : formatScore(report.avgExamScore),
            hint: "Bài trong kỳ, đã công bố kết quả",
          },
          {
            icon: BookOpen,
            label: "Tiến độ khóa học",
            value: formatPercent(report.progress?.progress_percent),
            hint: `${report.progress?.completed_lessons ?? 0}/${report.progress?.total_lessons ?? 0} bài học · nộp ${report.progress?.submitted_exercises ?? 0}/${report.progress?.total_exercises ?? 0} bài tập`,
          },
        ]}
      />

      {report.atRisk && (
        <Card className="border-warning/40 bg-warning/5 mt-4">
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden />
            <p className="text-sm font-medium">
              Đang cần chú ý: {report.atRisk.risk_reasons.join(" · ")}
            </p>
            {report.progress && (
              <p className="text-muted-foreground text-sm">
                Ngưỡng của khóa: chuyên cần ≥{" "}
                {formatPercent(report.progress.min_attendance_rate)} · điểm ≥{" "}
                {formatScore(report.progress.min_overall_score)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle asChild className="text-base">
              <h2>Lịch sử điểm danh trong kỳ</h2>
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Buổi mới nhất lên đầu. Buổi đã qua mà chưa điểm danh hiện
              &ldquo;Chưa điểm danh&rdquo;.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {report.attendanceHistory.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Kỳ này chưa có buổi học nào"
                description="Chọn kỳ khác để xem lịch sử điểm danh."
              />
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Trạng thái điểm danh từng buổi của học viên trong kỳ đang
                  chọn.
                </caption>
                <thead className="text-muted-foreground border-b text-left text-sm">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-medium">
                      Buổi
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Ngày
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Trạng thái
                    </th>
                    <th scope="col" className="px-5 py-2 font-medium">
                      Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.attendanceHistory.map(({ session, record }) => (
                    <tr key={session.id}>
                      <td className="px-5 py-2.5 tabular-nums">
                        B{session.session_number}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDate(session.starts_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        {record ? (
                          <StatusBadge
                            label={ATTENDANCE_STATUS_LABELS[record.status]}
                            tone={ATTENDANCE_STATUS_TONE[record.status]}
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            Chưa điểm danh
                          </span>
                        )}
                      </td>
                      <td className="text-muted-foreground max-w-48 px-5 py-2.5">
                        {record?.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ScoreTable
            title="Bài kiểm tra trong kỳ"
            emptyText="Kỳ này không có bài kiểm tra nào."
            dateHeader="Ngày thi"
            rows={report.examRows.map((row) => ({
              id: row.id,
              title: row.title,
              date: row.opensAt,
              score: row.score,
              state: row.state,
            }))}
          />
          <ScoreTable
            title="Bài tập trong kỳ"
            emptyText="Kỳ này không có bài tập nào tới hạn."
            dateHeader="Hạn nộp"
            rows={report.exerciseRows.map((row) => ({
              id: row.id,
              title: row.title,
              date: row.dueAt,
              score: row.score,
              state: row.state,
            }))}
          />
        </div>
      </div>
    </>
  );
}

function ScoreTable({
  title,
  emptyText,
  dateHeader,
  rows,
}: {
  title: string;
  emptyText: string;
  dateHeader: string;
  rows: {
    id: string;
    title: string;
    date: string | null;
    score: number | null;
    state: "published" | "submitted" | "missing";
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-base">
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-5 pb-4 text-sm">{emptyText}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              {title}: tên bài, {dateHeader.toLowerCase()} và điểm trên thang
              100.
            </caption>
            <thead className="text-muted-foreground border-b text-left text-sm">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">
                  Bài
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {dateHeader}
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Điểm (/100)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="max-w-56 px-5 py-2.5">
                    <span className="block truncate font-medium">
                      {row.title}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {row.state === "published" ? (
                      <span className="font-semibold tabular-nums">
                        {formatScore(row.score)}
                      </span>
                    ) : row.state === "submitted" ? (
                      <span className="text-muted-foreground">
                        Đã nộp — chờ công bố
                      </span>
                    ) : (
                      <span className="text-warning font-medium">Chưa nộp</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
