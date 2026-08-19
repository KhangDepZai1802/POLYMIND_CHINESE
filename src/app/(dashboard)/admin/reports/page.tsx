import type { Metadata } from "next";
import Link from "next/link";

import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileCheck2,
  GraduationCap,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AdminAttendanceBoard } from "@/features/attendance/components/admin-attendance-board";
import { getAdminAttendanceBoard } from "@/features/attendance/server/admin-queries";
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
import { AdminTeacherReportsTab } from "@/features/session-reports/components/admin-teacher-reports";
import { parseTeacherReportFilters } from "@/features/session-reports/schema";
import {
  getAdminTeacherReports,
  getMissingReportCount,
} from "@/features/session-reports/server/queries";
import { requireManager } from "@/lib/auth/session";
import { formatPercent, formatScore, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Báo cáo" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/admin/reports` (`REPORT-REDESIGN-1`) — bốn tab trên URL:
 *
 *   • `tab=hoc-tap` (MẶC ĐỊNH) — tiến độ học tập + điểm danh, tầng 1 của cấu
 *     trúc Trung tâm → Lớp → Học viên (D3).
 *   • `tab=hoc-phi` — nguyên màn báo cáo học phí cũ (D1), không đổi nghiệp vụ.
 *   • `tab=bao-cao-gv` — báo cáo sau buổi dạy của giáo viên (`TEACHER-REPORT-1`).
 *   • `tab=diem-danh` — sổ điểm danh mọi lớp/mọi buổi, SỬA ĐƯỢC
 *     (`ADMIN-ATTENDANCE-1`, `D-45`).
 *
 * Tab là LINK chứ không phải state client: kỳ lọc + tab sống trên URL để
 * deep-link/Back/export cùng nhìn một nguồn sự thật.
 *
 * ⚠️ Trang gác bằng `requireManager()` = super_admin ∪ academic_manager, và cả
 * hai role đều trỏ `/admin/reports` trong `navigation.ts`. Thêm tab một lần là
 * CẢ HAI cùng thấy — không có "module báo cáo của admin" riêng để clone.
 */
export default async function AdminReportsPage({ searchParams }: Props) {
  const currentUser = await requireManager();
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab =
    rawTab === "hoc-phi"
      ? "hoc-phi"
      : rawTab === "bao-cao-gv"
        ? "bao-cao-gv"
        : rawTab === "diem-danh"
          ? "diem-danh"
          : "hoc-tap";

  /*
   * 🔴 Con số đỏ đếm TOÀN BỘ nợ, KHÔNG theo kỳ đang lọc.
   *
   * Chạy theo bộ lọc thì đổi sang tháng khác là nợ biến mất khỏi màn hình —
   * đúng thứ không được phép giấu. Vì vậy nó tải ở TẦNG TRANG, không nằm trong
   * tab, để đứng ở tab Học phí vẫn thấy.
   */
  const missingReports = await getMissingReportCount();

  const tabs = [
    { key: "hoc-tap", label: "Học tập", href: "/admin/reports" },
    { key: "hoc-phi", label: "Học phí", href: "/admin/reports?tab=hoc-phi" },
    {
      key: "bao-cao-gv",
      label: "Báo cáo của giáo viên",
      href: "/admin/reports?tab=bao-cao-gv",
      badge: missingReports,
    },
    // Kỳ mặc định của tab này là TOÀN KHÓA, nên link phải mang sẵn `range=all`:
    // đang đứng ở tab Học tập (tháng này) mà bấm sang thì `from`/`to` của tháng
    // còn nguyên trên URL và tab mới mở ra chỉ thấy một tháng — trong khi việc
    // của nó đúng là "coi lại tất cả các buổi".
    {
      key: "diem-danh",
      label: "Điểm danh",
      href: "/admin/reports?tab=diem-danh&range=all",
    },
  ] as const;

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description="Tiến độ học tập, chuyên cần, học phí và báo cáo buổi dạy — số liệu tính từ dữ liệu thật theo kỳ đang chọn."
      />

      {/*
        `flex-wrap` chứ không `overflow-x-auto`: ba nhãn ở 360px thì xuống dòng,
        không sinh thêm một vùng cuộn ngang không có dấu hiệu nào — bài học
        `UX-MOBILE-1`.
      */}
      <nav
        aria-label="Loại báo cáo"
        data-noprint
        className="mb-4 flex flex-wrap gap-1 border-b"
      >
        {tabs.map((item) => {
          const active = tab === item.key;
          const badge = "badge" in item ? item.badge : 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-primary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent font-medium"
              }`}
            >
              {item.label}
              {badge > 0 && (
                /*
                  Con số LÀ tín hiệu, không phải màu. Nhãn trợ năng nói rõ nó
                  đếm cái gì — "3" đứng trần trụi thì trình đọc màn hình chỉ đọc
                  được một con số vô nghĩa.
                */
                <span
                  className="bg-destructive/12 text-danger-ink border-destructive/25 min-w-5 rounded-full border px-1.5 text-center font-mono text-xs font-bold tabular-nums"
                  aria-label={`${badge} buổi chưa có báo cáo`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "hoc-phi" ? (
        <TuitionTab params={params} />
      ) : tab === "bao-cao-gv" ? (
        <TeacherReportsTab params={params} />
      ) : tab === "diem-danh" ? (
        <AttendanceTab params={params} role={currentUser.role} />
      ) : (
        <LearningTab params={params} />
      )}
    </>
  );
}

/**
 * Tab "Điểm danh" (`ADMIN-ATTENDANCE-1`, user chốt 2026-08-19 → `D-45`).
 *
 * 🔴 KỲ MẶC ĐỊNH LÀ **TOÀN KHÓA**, khác ba tab kia (tháng này). Nguyên văn yêu
 * cầu của user là *"coi lại các điểm danh của tất cả các lớp của tất cả các
 * buổi"* — mở ra chỉ thấy tháng hiện tại là thiếu đúng thứ họ cần. Lưới không
 * phình theo vì mỗi lớp là một mục THU GỌN sẵn.
 */
async function AttendanceTab({
  params,
  role,
}: {
  params: Record<string, string | string[] | undefined>;
  role: string;
}) {
  const parsed = parseLearningReportFilters(params);
  const filters = parsed.success ? parsed.data : {};
  const period = resolveLearningPeriod(filters, todayISO(), "all");
  const board = await getAdminAttendanceBoard(period);

  return (
    <>
      <ReportPrintHeader
        title="Sổ điểm danh toàn trung tâm"
        periodLabel={period.label}
      />
      <ReportPeriodFilter
        basePath="/admin/reports"
        filters={filters}
        period={period}
        hiddenParams={{ tab: "diem-danh" }}
        errorMessage={parsed.success ? undefined : parsed.error.issues[0]?.message}
      />

      <StatTiles
        tiles={[
          {
            icon: CalendarCheck,
            label: "Buổi đã diễn ra",
            value: String(board.totals.sessions),
            hint: `trên ${board.classes.length} lớp`,
          },
          {
            icon: ClipboardCheck,
            label: "Ô đã điểm danh",
            value: `${board.totals.marked}/${board.totals.expected}`,
            hint:
              board.totals.expected > 0
                ? formatPercent(board.totals.marked / board.totals.expected)
                : "—",
          },
          {
            icon: AlertTriangle,
            label: "Ô còn trống",
            value: String(board.totals.expected - board.totals.marked),
            // Ô trống CHẶN giáo viên gửi báo cáo — nói ra hậu quả, không chỉ nói
            // con số, vì đó mới là lý do giáo vụ phải quan tâm tới nó.
            hint: "buổi thiếu ô nào thì giáo viên chưa gửi được báo cáo",
            tone:
              board.totals.expected - board.totals.marked > 0
                ? "warning"
                : "default",
          },
          {
            icon: FileCheck2,
            label: "Buổi đã có báo cáo ký",
            value: String(board.totals.sessionsWithSubmittedReport),
            hint: "sửa điểm danh sẽ cập nhật lại số trong báo cáo",
          },
        ]}
      />

      {/*
        🔴 `canEdit` do ROLE quyết, và đây KHÔNG phải chốt chặn — chốt chặn là
        `app.is_super_admin()` trong RPC `admin_override_attendance` (có pgTAP
        ghim: giáo vụ gọi thẳng RPC vẫn bị chặn). Ẩn nút chỉ để giáo vụ không
        bấm vào một thứ chắc chắn sẽ báo lỗi.
      */}
      <AdminAttendanceBoard board={board} canEdit={role === "super_admin"} />
    </>
  );
}

async function TeacherReportsTab({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const parsed = parseTeacherReportFilters(params);
  const filters = parsed.success ? parsed.data : {};
  // Mặc định tháng hiện tại — cùng kỳ vận hành với tab Học tập, để giáo vụ đổi
  // tab không bị nhảy sang một khoảng thời gian khác.
  const period = resolveLearningPeriod(filters, todayISO(), "month");

  // `period.from/to` là null khi kỳ = Toàn khóa; query hiểu `undefined` là
  // không giới hạn nên phải quy về đúng kiểu đó.
  const data = await getAdminTeacherReports({
    ...filters,
    from: period.from ?? undefined,
    to: period.to ?? undefined,
  });

  return (
    <>
      <ReportPrintHeader
        title="Báo cáo buổi dạy của giáo viên"
        periodLabel={period.label}
      />
      <ReportPeriodFilter
        basePath="/admin/reports?tab=bao-cao-gv"
        filters={filters}
        period={period}
        errorMessage={parsed.success ? undefined : parsed.error.issues[0]?.message}
      />
      <AdminTeacherReportsTab data={data} filters={filters} />
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
