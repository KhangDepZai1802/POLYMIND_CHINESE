import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
} from "lucide-react";

import { PrintButton } from "@/features/reports/components/print-button";
import { StatTiles } from "@/features/reports/components/stat-tiles";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatPercent } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { issueSeverityOption, overallRatingOption } from "../domain/labels";
import type { AdminReportRow, AdminTeacherReportData } from "../server/queries";
import { teacherReportSearchParams, type TeacherReportFilters } from "../schema";
import { RemindTeacherButton } from "./remind-teacher-button";
import { WaiveReportButton } from "./waive-report-button";

/**
 * Tab "Báo cáo của giáo viên" ở `/admin/reports` (`TEACHER-REPORT-1`).
 *
 * 🔴 THỨ TỰ CÓ CHỦ ĐÍCH: hai khối cảnh báo đứng TRƯỚC các ô số thống kê. Giáo
 * vụ mở trang này để biết còn thiếu gì và có gì cần xử lý ngay — không phải để
 * ngắm tỉ lệ 83%.
 */
export function AdminTeacherReportsTab({
  data,
  filters,
}: {
  data: AdminTeacherReportData;
  filters: TeacherReportFilters;
}) {
  const missing = data.rows.filter((row) => row.status === "missing");

  // 🔴 Link xuất file dựng từ CHÍNH bộ lọc đang hiển thị (`BUG_M16_01`).
  const exportHref = (format: "docx") => {
    const params = teacherReportSearchParams(filters);
    params.set("report", "teacher-reports");
    params.set("format", format);
    return `/api/export/reports?${params.toString()}`;
  };

  return (
    <>
      <div data-noprint className="mb-4 flex flex-wrap justify-end gap-2">
        <PrintButton />
        <Button asChild variant="outline">
          <a href={exportHref("docx")}>
            <Download className="size-4" aria-hidden />
            Tải DOCX
          </a>
        </Button>
      </div>

      {missing.length > 0 && (
        <Alert variant="destructive" className="mb-4" data-noprint>
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>
            {missing.length} buổi đã dạy nhưng chưa có báo cáo
          </AlertTitle>
          <AlertDescription className="mt-2 block">
            <ul className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
              {missing.slice(0, 8).map((row) => (
                <li
                  key={row.sessionId}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">
                      <span className="font-mono">{row.classCode}</span> · Buổi{" "}
                      {row.sessionNumber} · {formatDate(row.startsAt)}
                    </p>
                    <p className="text-text-secondary text-xs">
                      {row.teacherName} ·{" "}
                      {row.attendanceDone
                        ? `quá hạn ${row.daysSince} ngày`
                        : `chưa điểm danh xong (${row.marked}/${row.expected})`}
                    </p>
                  </div>
                  {/*
                    Buổi chưa điểm danh xong thì KHÔNG hiện nút nhắc gửi báo
                    cáo — giáo viên chưa làm được, nhắc chỉ tạo nhiễu. Nói đúng
                    việc đang chặn thay vì giục một việc bất khả thi.

                    🔴 "Không cần báo cáo" (`TEACHER-REPORT-5`) đứng CẠNH nút
                    nhắc và cùng điều kiện `attendanceDone` — đúng chỗ user chỉ
                    trong ảnh, và đúng lúc: giáo vụ vừa nhìn thấy buổi bị nhắc
                    mới quyết được là buổi đó có cần báo cáo hay không.
                  */}
                  {row.attendanceDone ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <RemindTeacherButton sessionId={row.sessionId} />
                      <WaiveReportButton sessionId={row.sessionId} waived={false} />
                    </div>
                  ) : (
                    <StatusBadge label="Chờ điểm danh" tone="warning" />
                  )}
                </li>
              ))}
            </ul>
            {missing.length > 8 && (
              <p className="text-text-secondary mt-2 text-xs">
                … và {missing.length - 8} buổi nữa trong bảng bên dưới.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {data.attention.length > 0 && (
        <Alert className="border-warning/40 bg-warning/5 mb-4" data-noprint>
          <AlertTriangle className="text-warning size-4" aria-hidden />
          <AlertTitle>{data.attention.length} báo cáo cần xử lý ngay</AlertTitle>
          <AlertDescription className="mt-1 block">
            <ul className="grid gap-1">
              {data.attention.map((row) => (
                <li key={row.sessionId} className="text-sm">
                  <span className="font-mono">{row.classCode}</span> · Buổi{" "}
                  {row.sessionNumber} — {row.teacherName} ·{" "}
                  {row.issueSeverity === "high"
                    ? "vấn đề mức Cao"
                    : "đánh giá chung: Chưa đạt"}
                  {row.reportId && (
                    <Link
                      href={`/admin/reports/bao-cao/${row.reportId}`}
                      className="text-primary ml-2 font-semibold underline underline-offset-2"
                    >
                      Xem →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <StatTiles
        tiles={[
          {
            icon: CalendarCheck,
            label: "Buổi đã dạy trong kỳ",
            value: String(data.stats.taught),
            hint: "không tính buổi đã huỷ",
          },
          {
            icon: ClipboardList,
            label: "Đã có báo cáo",
            value: String(data.stats.submitted),
            /*
              Mẫu số TRỪ buổi đã miễn (`TEACHER-REPORT-5`). Giữ nguyên `taught`
              thì miễn ba buổi xong tỉ lệ tụt xuống — giáo vụ vừa dọn đúng ba
              buổi không cần báo cáo mà con số lại xấu đi, đọc như bị phạt.
            */
            hint: (() => {
              const required = data.stats.taught - data.stats.waived;
              return required > 0
                ? formatPercent(data.stats.submitted / required)
                : "—";
            })(),
          },
          {
            icon: AlertTriangle,
            label: "Chưa gửi",
            value: String(data.stats.missing),
            // Buổi đã miễn KHÔNG nằm trong con số này; nói ra để giáo vụ không
            // phải đoán vì sao "đã dạy 7" mà "đã gửi 4 + chưa gửi 0".
            hint:
              data.stats.waived > 0
                ? `tính cả buổi chưa điểm danh · ${data.stats.waived} buổi không cần báo cáo`
                : "tính cả buổi chưa điểm danh",
            tone: data.stats.missing > 0 ? "warning" : "default",
          },
          {
            icon: GraduationCap,
            label: "TB mức tiếp thu",
            value:
              data.stats.avgComprehension === null
                ? "—"
                : data.stats.avgComprehension.toFixed(1).replace(".", ","),
            hint: "thang 1–5",
          },
        ]}
      />

      {data.rows.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Không có buổi dạy nào trong kỳ đang chọn.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bảng 11 cột — cuộn ngang TRONG khung riêng, đúng luật `D-31` điểm 2. */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken text-text-secondary">
                    {[
                      "Ngày",
                      "Lớp",
                      "Buổi",
                      "Giáo viên",
                      "Bài / Chủ đề",
                      "Tiếp thu",
                      "Tương tác",
                      "Tập trung",
                      "Vấn đề",
                      "Trạng thái",
                      "",
                    ].map((head) => (
                      <th
                        key={head}
                        className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.sessionId} className="hover:bg-row-hover border-t">
                      <td className="px-3 py-2 font-mono whitespace-nowrap tabular-nums">
                        {formatDate(row.startsAt)}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {row.classCode}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {row.sessionNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.teacherName}</td>
                      <td className="max-w-56 truncate px-3 py-2">
                        {row.topic ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip value={row.comprehension} />
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip value={row.interaction} />
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip value={row.focus} />
                      </td>
                      <td className="px-3 py-2">
                        <IssueChip row={row} />
                      </td>
                      <td className="px-3 py-2">
                        <ReportStateBadge row={row} />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {row.reportId ? (
                          <Link
                            href={`/admin/reports/bao-cao/${row.reportId}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <FileText className="size-4" aria-hidden />
                            Xem
                          </Link>
                        ) : row.status === "waived" ? (
                          <WaiveReportButton
                            sessionId={row.sessionId}
                            waived
                            label="Cần lại"
                          />
                        ) : row.attendanceDone ? (
                          <span className="inline-flex flex-wrap justify-end gap-1.5">
                            <RemindTeacherButton sessionId={row.sessionId} label="Nhắc" />
                            <WaiveReportButton
                              sessionId={row.sessionId}
                              waived={false}
                              label="Không cần"
                            />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/*
            Dưới `md` bảng 11 cột thành danh sách thẻ. Ba điểm số mang NHÃN CHỮ
            đi kèm — con số 4 đứng trần trụi thì mất hết ngữ cảnh.
          */}
          <ul className="mt-4 grid gap-2 md:hidden">
            {data.rows.map((row) => (
              <li key={row.sessionId}>
                <Card>
                  <CardContent className="grid gap-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          <span className="font-mono">{row.classCode}</span> · Buổi{" "}
                          {row.sessionNumber}
                        </p>
                        <p className="text-text-secondary text-xs">
                          {formatDate(row.startsAt)} · {row.teacherName}
                        </p>
                      </div>
                      <ReportStateBadge row={row} />
                    </div>

                    {row.topic && <p className="text-sm">{row.topic}</p>}

                    {row.status === "submitted" ? (
                      <div className="flex flex-wrap gap-1.5">
                        <ScoreChip value={row.comprehension} label="Tiếp thu" />
                        <ScoreChip value={row.interaction} label="Tương tác" />
                        <ScoreChip value={row.focus} label="Tập trung" />
                        <IssueChip row={row} />
                      </div>
                    ) : row.status === "waived" ? (
                      <p className="text-text-secondary text-xs">
                        {row.waiveReason
                          ? `Không cần báo cáo — ${row.waiveReason}`
                          : "Giáo vụ đã đánh dấu không cần báo cáo"}
                      </p>
                    ) : (
                      <p className="text-text-secondary text-xs">
                        {row.attendanceDone
                          ? `Quá hạn ${row.daysSince} ngày`
                          : `Chưa điểm danh xong (${row.marked}/${row.expected})`}
                      </p>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {row.reportId ? (
                        <Link
                          href={`/admin/reports/bao-cao/${row.reportId}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <FileText className="size-4" aria-hidden />
                          Xem báo cáo
                        </Link>
                      ) : row.status === "waived" ? (
                        <WaiveReportButton sessionId={row.sessionId} waived />
                      ) : row.attendanceDone ? (
                        <>
                          <RemindTeacherButton sessionId={row.sessionId} />
                          <WaiveReportButton sessionId={row.sessionId} waived={false} />
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * Trạng thái báo cáo của một buổi — BA giá trị, không phải hai.
 *
 * Dùng chung cho bảng ≥768px và danh sách thẻ ở màn hẹp: hai chỗ tự viết lấy là
 * có ngày bảng hiện "Chưa gửi" đỏ cho đúng buổi mà thẻ hiện "Không cần báo cáo".
 */
function ReportStateBadge({ row }: { row: AdminReportRow }) {
  if (row.status === "submitted") return <StatusBadge label="Đã gửi" tone="success" />;
  // `neutral` chứ không `danger`: buổi đã miễn là việc ĐÃ XỬ LÝ, không phải nợ.
  if (row.status === "waived") {
    return <StatusBadge label="Không cần báo cáo" tone="neutral" />;
  }
  return <StatusBadge label="Chưa gửi" tone="danger" />;
}

/** Điểm 1–5 — màu đi kèm con số, không bao giờ thay con số. */
function ScoreChip({ value, label }: { value: number | null; label?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        value <= 2
          ? "border-destructive/30 bg-destructive/10 text-danger-ink"
          : value === 3
            ? "border-warning/30 bg-warning/10 text-warning"
            : "border-success/30 bg-success/10 text-success",
      )}
    >
      {label && <span className="font-normal">{label}</span>}
      {value}
    </span>
  );
}

function IssueChip({ row }: { row: AdminReportRow }) {
  if (row.status !== "submitted") return <span className="text-muted-foreground">—</span>;
  if (!row.hasIssue) return <StatusBadge label="Không" tone="neutral" />;

  const severity = issueSeverityOption(row.issueSeverity);
  const rating = overallRatingOption(row.overallRating);

  return (
    <span className="inline-flex flex-wrap gap-1">
      <StatusBadge
        label={severity ? `Mức ${severity.label}` : "Có vấn đề"}
        tone={row.issueSeverity === "high" ? "danger" : "warning"}
      />
      {rating?.value === "unsatisfactory" && (
        <StatusBadge label="Chưa đạt" tone="danger" />
      )}
    </span>
  );
}
