import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ATTENDANCE_CELL,
  ATTENDANCE_STATUSES,
  UNMARKED_LABEL,
  UNMARKED_SYMBOL,
} from "@/features/attendance/status-display";
import { formatDate, formatPercent } from "@/lib/dates";

import type { AttendanceStatus, AttendanceSummary } from "../learning";
import type { PeriodSession } from "../server/learning-queries";

/**
 * Sổ điểm danh trực quan (D7, AC2.1): hàng = học viên, cột = buổi trong kỳ.
 *
 * Đây là thứ tỉ lệ % không bao giờ lộ ra: hai em cùng 80% nhưng một em vắng
 * rải rác, một em vắng 3 buổi LIỀN — lưới cho thấy ngay mẫu đó.
 *
 * Mỗi ô là ký hiệu chữ + màu (`color-not-only`): ✓ có mặt · M muộn · V vắng ·
 * P có phép · — chưa điểm danh. Trình đọc màn hình đọc nhãn đầy đủ qua sr-only.
 *
 * ⚠️ Bảng ký hiệu KHÔNG còn nằm trong file này — nó ở
 * `@/features/attendance/status-display` để lưới SỬA ĐƯỢC của tab Điểm danh
 * (`ADMIN-ATTENDANCE-1`) dùng chung. Hai bảng ký hiệu cho cùng một khái niệm là
 * đường ngắn nhất tới chuyện "vắng" đọc ra hai kiểu ở hai tab.
 */

export type AttendanceGridRow = {
  enrollmentId: string;
  name: string;
  code?: string;
  /** Bấm tên → hồ sơ học viên (mỗi ngữ cảnh một đường: admin/giáo viên). */
  href?: string;
  summary: AttendanceSummary;
};

export function AttendanceGrid({
  sessions,
  rows,
  cellByKey,
}: {
  sessions: PeriodSession[];
  rows: AttendanceGridRow[];
  cellByKey: ReadonlyMap<string, { status: AttendanceStatus; note: string | null }>;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle asChild className="text-base">
          <h2>Sổ điểm danh trong kỳ</h2>
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Mỗi cột một buổi — nhìn ngang thấy ngay chuỗi vắng liên tiếp của từng
          em.
        </p>
        {/* Chú giải đứng TRÊN lưới và không cuộn theo — người đọc không phải
            nhớ ký hiệu khi đã cuộn tới cột thứ 30. */}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {ATTENDANCE_STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${ATTENDANCE_CELL[status].className}`}
              >
                {ATTENDANCE_CELL[status].symbol}
              </span>
              {ATTENDANCE_CELL[status].label}
            </li>
          ))}
          <li className="text-muted-foreground flex items-center gap-1.5">
            <span aria-hidden className="grid size-5 shrink-0 place-items-center">
              {UNMARKED_SYMBOL}
            </span>
            {UNMARKED_LABEL}
          </li>
        </ul>
      </CardHeader>
      <CardContent className="p-0">
        {sessions.length === 0 || rows.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={
              sessions.length === 0
                ? "Kỳ này chưa có buổi học nào đã diễn ra"
                : "Lớp chưa có học viên đang học"
            }
            description={
              sessions.length === 0
                ? "Chọn kỳ khác hoặc chờ tới buổi học đầu tiên của kỳ."
                : "Ghi danh học viên vào lớp để bắt đầu điểm danh."
            }
          />
        ) : (
          <div
            data-slot="table-scroller"
            role="region"
            aria-label="Sổ điểm danh, cuộn ngang để xem đủ các buổi"
            tabIndex={0}
            className="focus-visible:ring-ring overflow-x-auto focus-visible:ring-2 focus-visible:outline-none"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">
                Sổ điểm danh từng buổi của từng học viên trong kỳ đang chọn:
                có mặt, đến muộn, vắng, có phép hoặc chưa điểm danh.
              </caption>
              <thead className="text-muted-foreground border-b text-sm">
                <tr>
                  <th
                    scope="col"
                    className="bg-card sticky left-0 z-10 border-r px-4 py-2 text-left font-medium"
                  >
                    Học viên
                  </th>
                  {sessions.map((session) => (
                    <th
                      key={session.id}
                      scope="col"
                      className="min-w-11 px-1 py-2 text-center font-medium"
                    >
                      <span className="block tabular-nums">
                        B{session.session_number}
                      </span>
                      <span className="block text-xs font-normal tabular-nums">
                        {formatDate(session.starts_at).slice(0, 5)}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Chuyên cần
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.enrollmentId} className="even:bg-muted/40">
                    <th
                      scope="row"
                      className="bg-card sticky left-0 z-10 max-w-52 border-r px-4 py-2 text-left font-normal"
                    >
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="block truncate font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium">
                          {row.name}
                        </span>
                      )}
                      {row.code && (
                        <span className="text-muted-foreground block text-xs">
                          {row.code}
                        </span>
                      )}
                    </th>
                    {sessions.map((session) => {
                      const cell = cellByKey.get(
                        `${session.id}:${row.enrollmentId}`,
                      );
                      if (!cell) {
                        return (
                          <td key={session.id} className="px-1 py-2 text-center">
                            <span aria-hidden className="text-muted-foreground">
                              {UNMARKED_SYMBOL}
                            </span>
                            <span className="sr-only">{UNMARKED_LABEL}</span>
                          </td>
                        );
                      }
                      const style = ATTENDANCE_CELL[cell.status];
                      return (
                        <td
                          key={session.id}
                          className="px-1 py-2 text-center"
                          title={cell.note ?? undefined}
                        >
                          <span
                            aria-hidden
                            className={`mx-auto grid size-7 place-items-center rounded-full text-xs font-semibold ${style.className}`}
                          >
                            {style.symbol}
                          </span>
                          <span className="sr-only">
                            {style.label}
                            {cell.note ? ` — ${cell.note}` : ""}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row.summary.rate === null
                        ? "—"
                        : formatPercent(row.summary.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
