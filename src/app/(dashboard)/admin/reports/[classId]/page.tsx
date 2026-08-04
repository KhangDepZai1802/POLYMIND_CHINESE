import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { requireManager } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Báo cáo lớp" };

/**
 * Tầng 2 — chi tiết một lớp (US-2). Thân báo cáo là `ClassReportDetail` dùng
 * chung với trang giáo viên (D8); trang này chỉ gác quyền, đọc kỳ từ URL và
 * nối breadcrumb về tầng tổng quan **mang theo kỳ đang lọc** (AC1.3).
 */
export default async function AdminClassReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const { classId } = await params;
  const query = await searchParams;

  const parsed = parseLearningReportFilters(query);
  const filters = parsed.success ? parsed.data : {};
  const period = resolveLearningPeriod(filters, todayISO(), "month");

  const report = await getClassLearningReport(classId, period);
  if (!report) notFound();

  const search = learningFilterSearchParams(filters).toString();
  const backHref = `/admin/reports${search ? `?${search}` : ""}`;

  return (
    <>
      <div data-noprint className="mb-3">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden /> Báo cáo toàn trung tâm
        </Link>
      </div>

      <ReportPrintHeader
        title="Báo cáo học tập theo lớp"
        periodLabel={period.label}
        scopeLabel={`${report.classInfo.code} — ${report.classInfo.name}`}
      />

      <PageHeader
        title={`Lớp ${report.classInfo.code}`}
        description={report.classInfo.name}
        action={
          <div data-noprint>
            <PrintButton />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={CLASS_STATUS_LABELS[report.classInfo.status]}
          tone={CLASS_STATUS_TONE[report.classInfo.status]}
        />
        <span className="text-muted-foreground text-sm">
          Kỳ đang xem: {period.label}
        </span>
      </div>

      <ReportPeriodFilter
        basePath={`/admin/reports/${classId}`}
        filters={filters}
        period={period}
        errorMessage={
          parsed.success ? undefined : parsed.error.issues[0]?.message
        }
      />

      <ClassReportDetail
        report={report}
        studentHref={(enrollmentId) =>
          `/admin/reports/${classId}/${enrollmentId}${search ? `?${search}` : ""}`
        }
      />
    </>
  );
}
