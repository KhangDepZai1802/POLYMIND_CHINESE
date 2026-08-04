import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/features/reports/components/print-button";
import { ReportPeriodFilter } from "@/features/reports/components/report-period-filter";
import { ReportPrintHeader } from "@/features/reports/components/report-print-header";
import { StudentReportDetail } from "@/features/reports/components/student-report-detail";
import { resolveLearningPeriod } from "@/features/reports/learning";
import {
  learningFilterSearchParams,
  parseLearningReportFilters,
} from "@/features/reports/schema";
import { getStudentLearningReport } from "@/features/reports/server/learning-queries";
import { requireTeaching } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Hồ sơ học tập" };

/**
 * Hồ sơ học tập một học viên, phía giáo viên (US-3).
 *
 * Fail-closed tự nhiên: giáo viên gõ tay `enrollmentId` của lớp người khác thì
 * RLS trả rỗng → 404, không cần thêm một lớp kiểm quyền ở app.
 */
export default async function TeacherStudentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeaching();
  const { enrollmentId } = await params;
  const query = await searchParams;

  const parsed = parseLearningReportFilters(query);
  const filters = parsed.success ? parsed.data : {};
  const period = resolveLearningPeriod(filters, todayISO(), "all");

  const report = await getStudentLearningReport(enrollmentId, period);
  if (!report) notFound();

  const search = learningFilterSearchParams(filters).toString();
  const classId = report.enrollment.class?.id;
  const backParams = new URLSearchParams(search);
  if (classId) backParams.set("class", classId);
  const backSearch = backParams.toString();
  const backHref = `/teacher/progress${backSearch ? `?${backSearch}` : ""}`;
  const student = report.enrollment.student;
  const classInfo = report.enrollment.class;

  return (
    <>
      <div data-noprint className="mb-3">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden /> Báo cáo lớp{" "}
          {classInfo?.code}
        </Link>
      </div>

      <ReportPrintHeader
        title="Hồ sơ học tập học viên"
        periodLabel={period.label}
        scopeLabel={`${student?.full_name ?? "Học viên"} (${student?.student_code ?? "—"}) · Lớp ${classInfo?.code ?? "—"}`}
      />

      <PageHeader
        title={student?.full_name ?? "Học viên"}
        description={`${student?.student_code ?? "—"} · Lớp ${classInfo?.code ?? "—"} — ${classInfo?.name ?? ""}`}
        action={
          <div data-noprint className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/teacher/evaluations/${enrollmentId}`}>
                Ghi nhận xét
              </Link>
            </Button>
            <PrintButton />
          </div>
        }
      />

      <ReportPeriodFilter
        basePath={`/teacher/progress/${enrollmentId}`}
        filters={filters}
        period={period}
        errorMessage={
          parsed.success ? undefined : parsed.error.issues[0]?.message
        }
      />

      <StudentReportDetail report={report} />
    </>
  );
}
