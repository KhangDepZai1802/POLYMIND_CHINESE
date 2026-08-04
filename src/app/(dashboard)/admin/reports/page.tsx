import type { Metadata } from "next";
import Link from "next/link";

import { AlertTriangle, CalendarCheck, Download, GraduationCap, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AtRiskPanel } from "@/features/reports/components/at-risk-panel";
import { ClassOverviewCards } from "@/features/reports/components/class-overview-cards";
import { PrintButton } from "@/features/reports/components/print-button";
import { ReportPeriodFilter } from "@/features/reports/components/report-period-filter";
import { ReportPrintHeader } from "@/features/reports/components/report-print-header";
import { StatTiles } from "@/features/reports/components/stat-tiles";
import { TuitionReport } from "@/features/reports/components/tuition-report";
import { WeeklyTrendChart } from "@/features/reports/components/weekly-trend-chart";
import { resolveLearningPeriod } from "@/features/reports/learning";
import {
  learningFilterSearchParams,
  parseAdminReportFilters,
  parseLearningReportFilters,
} from "@/features/reports/schema";
import {
  getAdminReportClasses,
  getAdminTuitionReport,
} from "@/features/reports/server/admin-queries";
import { getLearningOverview } from "@/features/reports/server/learning-queries";
import { requireManager } from "@/lib/auth/session";
import { formatPercent, formatScore, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Báo cáo" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/admin/reports` (`REPORT-REDESIGN-1`) — hai tab trên URL:
 *
 *   • `tab=hoc-tap` (MẶC ĐỊNH) — tiến độ học tập + điểm danh, tầng 1 của cấu
 *     trúc Trung tâm → Lớp → Học viên (D3).
 *   • `tab=hoc-phi` — nguyên màn báo cáo học phí cũ (D1), không đổi nghiệp vụ.
 *
 * Tab là LINK chứ không phải state client: kỳ lọc + tab sống trên URL để
 * deep-link/Back/export cùng nhìn một nguồn sự thật.
 */
export default async function AdminReportsPage({ searchParams }: Props) {
  await requireManager();
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = rawTab === "hoc-phi" ? "hoc-phi" : "hoc-tap";

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description="Tiến độ học tập, chuyên cần và học phí — số liệu tính từ dữ liệu thật theo kỳ đang chọn."
      />

      <nav
        aria-label="Loại báo cáo"
        data-noprint
        className="mb-4 flex gap-1 border-b"
      >
        {(
          [
            { key: "hoc-tap", label: "Học tập", href: "/admin/reports" },
            {
              key: "hoc-phi",
              label: "Học phí",
              href: "/admin/reports?tab=hoc-phi",
            },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-primary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent font-medium"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "hoc-phi" ? <TuitionTab params={params} /> : <LearningTab params={params} />}
    </>
  );
}

async function LearningTab({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const parsed = parseLearningReportFilters(params);
  const filters = parsed.success ? parsed.data : {};
  // Admin mở trang trắng thấy NGAY tháng hiện tại (AC1.1) — kỳ vận hành tự nhiên
  // của giáo vụ; muốn lũy kế thì một cú bấm "Toàn khóa".
  const period = resolveLearningPeriod(filters, todayISO(), "month");
  const overview = await getLearningOverview(period);
  const search = learningFilterSearchParams(filters).toString();

  const exportHref = (format: "csv" | "xlsx") => {
    const exportParams = learningFilterSearchParams(filters);
    exportParams.set("report", "learning");
    exportParams.set("format", format);
    return `/api/export/reports?${exportParams.toString()}`;
  };

  return (
    <>
      <ReportPrintHeader
        title="Báo cáo học tập toàn trung tâm"
        periodLabel={period.label}
      />

      <ReportPeriodFilter
        basePath="/admin/reports"
        filters={filters}
        period={period}
        errorMessage={
          parsed.success ? undefined : parsed.error.issues[0]?.message
        }
      />

      <div data-noprint className="mb-4 flex flex-wrap justify-end gap-2">
        <PrintButton />
        {(["csv", "xlsx"] as const).map((format) => (
          <Button key={format} asChild variant="outline">
            <a href={exportHref(format)}>
              <Download /> Xuất {format.toUpperCase()}
            </a>
          </Button>
        ))}
      </div>

      <StatTiles
        tiles={[
          {
            icon: Users,
            label: "Đang học",
            value: String(overview.kpis.activeStudents),
            hint: `trên ${overview.classes.length} lớp`,
          },
          {
            icon: CalendarCheck,
            label: "Chuyên cần TB trong kỳ",
            value:
              overview.kpis.attendanceRate === null
                ? "—"
                : formatPercent(overview.kpis.attendanceRate),
            hint: `${overview.kpis.sessionsHeld} buổi trong kỳ`,
          },
          {
            icon: GraduationCap,
            label: "Điểm TB trong kỳ",
            value:
              overview.kpis.avgScore === null
                ? "—"
                : formatScore(overview.kpis.avgScore),
            hint: "Bài đã chấm và công bố, thang 100",
          },
          {
            icon: AlertTriangle,
            label: "Cần chú ý",
            value: String(overview.kpis.atRiskCount),
            hint: "Theo ngưỡng của từng khóa học",
            tone: overview.kpis.atRiskCount > 0 ? "warning" : "default",
          },
        ]}
      />

      <ClassOverviewCards classes={overview.classes} hrefSearch={search} />

      <WeeklyTrendChart points={overview.trend} />

      <AtRiskPanel
        students={overview.atRisk}
        showClass
        studentHref={(student) =>
          `/admin/reports/${student.class_id}/${student.enrollment_id}${
            search ? `?${search}` : ""
          }`
        }
      />
    </>
  );
}

async function TuitionTab({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const parsed = parseAdminReportFilters(params);
  const filters = parsed.success ? parsed.data : {};
  const [report, classes] = await Promise.all([
    getAdminTuitionReport(filters),
    getAdminReportClasses(),
  ]);

  return (
    <TuitionReport
      filters={filters}
      errorMessage={parsed.success ? undefined : parsed.error.issues[0]?.message}
      report={report}
      classes={classes}
    />
  );
}
