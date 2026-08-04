import type { Metadata } from "next";

import { TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getClassOptions } from "@/features/classes/server/queries";
import { ClassReportDetail } from "@/features/reports/components/class-report-detail";
import { PrintButton } from "@/features/reports/components/print-button";
import { ReportPeriodFilter } from "@/features/reports/components/report-period-filter";
import { ReportPrintHeader } from "@/features/reports/components/report-print-header";
import { resolveLearningPeriod } from "@/features/reports/learning";
import {
  learningFilterSearchParams,
  parseLearningReportFilters,
} from "@/features/reports/schema";
import { getClassLearningReport } from "@/features/reports/server/learning-queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { requireTeaching } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Báo cáo lớp" };

/**
 * Báo cáo lớp của giáo viên (`REPORT-REDESIGN-1`, D8) — thân trang là
 * `ClassReportDetail` DÙNG CHUNG với `/admin/reports/[classId]`: cùng một
 * lớp, admin và giáo viên nhìn cùng một con số, không bao giờ lệch nhau.
 *
 * • RLS khoanh về `class_teachers` — không tự lọc `teacher_id` ở app.
 * • Kỳ mặc định là **Toàn khóa** (khác admin): giữ đúng số liệu lũy kế mà
 *   giáo viên vẫn quen nhìn (và `report.smoke.spec.ts` đang đối chiếu thẳng
 *   với `count(*)` trong DB); muốn soi một tuần/tháng thì chọn kỳ ở thanh lọc.
 */
export default async function TeacherProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeaching();
  const query = await searchParams;
  const requestedClassId = Array.isArray(query.class)
    ? query.class[0]
    : query.class;

  const classes = await getClassOptions();
  const selected =
    classes.find((item) => item.id === requestedClassId) ?? classes[0];

  const parsed = parseLearningReportFilters(query);
  const filters = parsed.success ? parsed.data : {};
  const period = resolveLearningPeriod(filters, todayISO(), "all");

  const report = selected
    ? await getClassLearningReport(selected.id, period)
    : null;

  const search = learningFilterSearchParams(filters).toString();

  return (
    <>
      <PageHeader
        title="Báo cáo lớp"
        description="Chuyên cần, tiến độ và điểm — do hệ thống tính từ dữ liệu thật, không phải số nhập tay."
        action={
          selected && report ? (
            <div data-noprint>
              <PrintButton />
            </div>
          ) : undefined
        }
      />

      <div data-noprint className="mb-5">
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
          <ReportPrintHeader
            title="Báo cáo học tập theo lớp"
            periodLabel={period.label}
            scopeLabel={`${selected.code} — ${selected.name}`}
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
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

          <ReportPeriodFilter
            basePath="/teacher/progress"
            filters={filters}
            period={period}
            hiddenParams={{ class: selected.id }}
            errorMessage={
              parsed.success ? undefined : parsed.error.issues[0]?.message
            }
          />

          <ClassReportDetail
            report={report}
            studentHref={(enrollmentId) =>
              `/teacher/progress/${enrollmentId}${search ? `?${search}` : ""}`
            }
            atRiskAction={(student) => ({
              href: `/teacher/evaluations/${student.enrollment_id}`,
              label: "Ghi nhận xét",
            })}
          />
        </>
      )}
    </>
  );
}
