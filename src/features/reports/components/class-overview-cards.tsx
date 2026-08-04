import Link from "next/link";
import { AlertTriangle, GraduationCap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, formatScore } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";
import type { Database } from "@/types/database";

type ClassStatus = Database["public"]["Enums"]["class_status"];

export type ClassOverviewCard = {
  id: string;
  code: string;
  name: string;
  status: ClassStatus;
  activeStudents: number;
  sessionsInPeriod: number;
  attendanceRate: number | null;
  avgScore: number | null;
  progressPercent: number | null;
  atRiskCount: number;
};

/**
 * Lưới thẻ lớp (D9/D11) — mỗi lớp một thẻ bấm được, dẫn xuống tầng chi tiết
 * lớp và MANG THEO kỳ đang lọc (`hrefSearch`).
 *
 * Thanh chuyên cần vẽ theo pattern `AttendanceBars`: rãnh nền luôn đủ 100% để
 * mắt có mốc so; lớp có học viên cần chú ý đổi màu thanh + LUÔN kèm dòng chữ
 * "N cần chú ý" — màu không bao giờ là kênh thông tin duy nhất.
 */
export function ClassOverviewCards({
  classes,
  hrefSearch,
}: {
  classes: ClassOverviewCard[];
  hrefSearch: string;
}) {
  if (classes.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="p-0">
          <EmptyState
            icon={GraduationCap}
            title="Chưa có lớp nào để báo cáo"
            description="Tạo lớp và ghi danh học viên để bắt đầu theo dõi tiến độ."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="report-classes-heading" className="mt-4">
      <h2 id="report-classes-heading" className="mb-3 text-base font-semibold">
        Theo lớp ({classes.length})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((item) => {
          const width =
            item.attendanceRate === null
              ? 0
              : Math.max(0, Math.min(100, item.attendanceRate));
          return (
            <Link
              key={item.id}
              href={`/admin/reports/${item.id}${hrefSearch ? `?${hrefSearch}` : ""}`}
              className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="hover:border-border-strong h-full gap-3 py-4 transition-colors">
                <CardContent className="px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {item.code}
                    </span>
                    <StatusBadge
                      label={CLASS_STATUS_LABELS[item.status]}
                      tone={CLASS_STATUS_TONE[item.status]}
                    />
                  </div>
                  <p className="mt-1 truncate font-medium">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {item.activeStudents} học viên đang học ·{" "}
                    {item.sessionsInPeriod} buổi trong kỳ
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="bg-muted h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          item.atRiskCount > 0 ? "bg-warning" : "bg-chart-1"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {item.attendanceRate === null
                        ? "—"
                        : formatPercent(item.attendanceRate)}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Chuyên cần trong kỳ
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-text-secondary">Điểm TB kỳ</dt>
                      <dd className="font-semibold tabular-nums">
                        {item.avgScore === null
                          ? "—"
                          : formatScore(item.avgScore)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Tiến độ khóa</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatPercent(item.progressPercent)}
                      </dd>
                    </div>
                  </dl>

                  {item.atRiskCount > 0 ? (
                    <p className="text-warning mt-3 flex items-center gap-1.5 text-sm font-medium">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden />
                      {item.atRiskCount} học viên cần chú ý
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-sm">
                      Không có học viên cần chú ý
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
