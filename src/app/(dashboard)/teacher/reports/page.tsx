import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  TriangleAlert,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTeacherReportQueue,
  isOverdue,
  type ReportQueueItem,
} from "@/features/session-reports/server/queries";
import { requireTeaching } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Báo cáo buổi dạy" };

/**
 * Hàng đợi báo cáo của giáo viên (`TEACHER-REPORT-1`).
 *
 * 🔴 CỔNG ĐIỂM DANH HIỆN NGAY Ở ĐÂY, không phải sau khi bấm vào. Buổi chưa
 * điểm danh xong thì nút đã là *Điểm danh trước* và dòng phụ nói rõ `3/18`.
 * Giáo viên không bao giờ mở ra một biểu mẫu rồi mới bị đuổi ngược lại — cách
 * đó lãng phí đúng một cú chạm và một lần tải trang.
 */
export default async function TeacherReportsPage() {
  await requireTeaching("super_admin");
  const queue = await getTeacherReportQueue();

  const pending = queue.filter((item) => item.reportStatus !== "submitted");
  const submitted = queue.filter((item) => item.reportStatus === "submitted");
  const overdue = pending.filter(isOverdue);
  const drafts = pending.filter((item) => item.reportStatus === "draft");

  return (
    <>
      <PageHeader
        title="Báo cáo buổi dạy"
        description="Mỗi buổi dạy xong cần một báo cáo. Điểm danh trước, rồi mới làm báo cáo."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Quá hạn" value={overdue.length} hint="quá 48 giờ" tone="danger" />
        <Tile
          label="Cần báo cáo"
          value={pending.length - drafts.length}
          hint="đã dạy, chưa gửi"
          tone={pending.length > drafts.length ? "warning" : "default"}
        />
        <Tile label="Nháp" value={drafts.length} hint="đang lưu dở" />
        <Tile
          label="Đã gửi"
          value={submitted.length}
          hint={`trên ${queue.length} buổi`}
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Không còn buổi nào cần báo cáo"
              description="Mọi buổi đã dạy đều đã có báo cáo gửi đi."
            />
          ) : (
            <ul className="divide-y">
              {pending.map((item) => (
                <QueueRow key={item.sessionId} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {submitted.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">
            Đã gửi
            <span className="text-muted-foreground ml-2 font-normal">
              {submitted.length} buổi
            </span>
          </h2>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y">
                {submitted.slice(0, 10).map((item) => (
                  <QueueRow key={item.sessionId} item={item} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </>
  );
}

function QueueRow({ item }: { item: ReportQueueItem }) {
  const late = isOverdue(item);
  const done = item.reportStatus === "submitted";
  const blocked = !item.attendanceDone && !done;

  return (
    <li
      className={cn(
        "border-l-4",
        done
          ? "border-l-transparent"
          : late
            ? "border-l-destructive"
            : item.reportStatus === "draft"
              ? "border-l-border-strong"
              : "border-l-brand-orange",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="font-mono text-sm">{item.classCode}</span> · Buổi{" "}
            {item.sessionNumber}
          </p>
          <p className="text-text-secondary text-sm">
            {formatDate(item.startsAt)} · {formatTime(item.startsAt)}–
            {formatTime(item.endsAt)}
            {blocked && (
              <>
                {" · "}
                <span className="text-warning font-semibold">
                  mới điểm danh {item.marked}/{item.expected}
                </span>
              </>
            )}
            {late && !blocked && (
              <>
                {" · "}
                <span className="text-destructive font-semibold">
                  quá hạn {item.daysSince} ngày
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <StatusBadge label="Đã gửi" tone="success" />
          ) : blocked ? (
            <StatusBadge label="Chờ điểm danh" tone="warning" />
          ) : item.reportStatus === "draft" ? (
            <StatusBadge label="Nháp" tone="neutral" />
          ) : late ? (
            <StatusBadge label="Quá hạn" tone="danger" />
          ) : (
            <StatusBadge label="Đã điểm danh" tone="success" />
          )}

          {/*
            Nút dẫn đi ĐÚNG việc kế tiếp: chưa điểm danh xong thì sang điểm
            danh, xong rồi mới vào biểu mẫu.
          */}
          {blocked ? (
            <Link
              href={`/teacher/attendance?session=${item.sessionId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ClipboardCheck className="size-4" aria-hidden />
              Điểm danh trước
            </Link>
          ) : (
            <Link
              href={`/teacher/reports/${item.sessionId}`}
              className={buttonVariants({
                variant: done ? "outline" : "default",
                size: "sm",
              })}
            >
              <FileText className="size-4" aria-hidden />
              {done
                ? "Xem báo cáo"
                : item.reportStatus === "draft"
                  ? "Viết tiếp"
                  : "Làm báo cáo"}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "danger" | "warning" | "default";
}) {
  const Icon = tone === "danger" ? TriangleAlert : ClipboardList;

  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </p>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "danger" && value > 0 && "text-destructive",
            tone === "warning" && value > 0 && "text-warning",
          )}
        >
          {value}
        </p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}
