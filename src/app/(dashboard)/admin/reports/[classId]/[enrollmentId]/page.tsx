import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { requireManager } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Hồ sơ học tập" };

type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

/**
 * Tầng 3 — hồ sơ học tập một học viên (US-3): vì sao em này được nêu tên.
 * Thân trang là `StudentReportDetail` dùng chung với phía giáo viên.
 */
export default async function AdminStudentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string; enrollmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const { classId, enrollmentId } = await params;
  const query = await searchParams;

  const parsed = parseLearningReportFilters(query);
  const filters = parsed.success ? parsed.data : {};
  const period = resolveLearningPeriod(filters, todayISO(), "month");

  const report = await getStudentLearningReport(enrollmentId, period);
  // Ghi danh không tồn tại HOẶC URL ghép sai lớp → 404, không âm thầm hiện
  // dữ liệu của lớp khác dưới breadcrumb sai.
  if (!report || report.enrollment.class?.id !== classId) notFound();

  const search = learningFilterSearchParams(filters).toString();
  const backHref = `/admin/reports/${classId}${search ? `?${search}` : ""}`;
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
          <div data-noprint>
            <PrintButton />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={
            ENROLLMENT_STATUS_LABELS[report.enrollment.status as EnrollmentStatus]
          }
          tone="neutral"
        />
        <span className="text-muted-foreground text-sm">
          Kỳ đang xem: {period.label}
        </span>
      </div>

      <ReportPeriodFilter
        basePath={`/admin/reports/${classId}/${enrollmentId}`}
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
