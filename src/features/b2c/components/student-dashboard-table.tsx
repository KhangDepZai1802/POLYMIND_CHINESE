"use client";

import { useState } from "react";
import { Eye, History } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { B2CStudentStatusDialog } from "@/features/b2c/components/student-status-dialog";
import {
  B2C_STUDENT_STATUS_COLORS,
  B2C_STUDENT_STATUS_LABELS,
} from "@/features/b2c/domain/student-status";
import { B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { B2C_LEARNING_GOAL_LABELS } from "@/features/b2c/domain/learning-goal";
import type { StudentListRow } from "@/features/b2c/domain/student-dashboard";

export const studentDate = (date: string | null) =>
  date ? date.split("-").reverse().join("/") : "—";
export function StudentStatusBadge({ row }: { row: StudentListRow }) {
  const status = row.enrollment?.status;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${status ? B2C_STUDENT_STATUS_COLORS[status] : "bg-slate-100 text-slate-600"}`}
    >
      {status ? B2C_STUDENT_STATUS_LABELS[status] : "Chưa ghi danh"}
    </span>
  );
}
export function StudentDashboardTable({
  rows,
  offset = 0,
  compact = false,
  canViewHistory = false,
  selected,
  onSelect,
  onSelectAll,
}: {
  rows: StudentListRow[];
  offset?: number;
  compact?: boolean;
  canViewHistory?: boolean;
  selected?: Set<string>;
  onSelect?: (id: string) => void;
  onSelectAll?: () => void;
}) {
  const [detail, setDetail] = useState<StudentListRow | null>(null);
  const headings = compact
    ? [
        "Mã học viên",
        "Học viên",
        "Trạng thái",
        "Lớp",
        "Điện thoại",
        "Hết học phí",
      ]
    : [
        "#",
        "Mã học viên",
        "Học viên",
        "Trạng thái",
        "Lớp",
        "Phụ huynh",
        "Điện thoại",
        "Ngày nhập học",
        "Hết học phí",
        "Số buổi",
        "Người chốt",
        "Nguồn khách",
        "Thao tác",
      ];
  return (
    <>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
        <table
          className={`w-full text-left text-[11px] ${compact ? "min-w-[650px]" : "min-w-[1250px]"}`}
        >
          <caption className="sr-only">
            {compact ? "Chi tiết nhóm học viên" : "Danh sách học viên B2C"}
          </caption>
          <thead className="bg-[#edf3fb] text-[#4c638a] dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {onSelectAll && (
                <th className="px-2 py-3">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả dòng trên trang"
                    checked={
                      rows.length > 0 && rows.every((r) => selected?.has(r.id))
                    }
                    onChange={onSelectAll}
                  />
                </th>
              )}
              {headings.map((h) => (
                <th key={h} className="px-2 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className="border-t border-slate-100 odd:bg-slate-50/40 dark:border-slate-800 dark:odd:bg-slate-800/20"
              >
                {onSelect && (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${r.student.full_name} lớp ${r.classInfo?.name ?? "chưa ghi danh"}`}
                      checked={selected?.has(r.id) ?? false}
                      onChange={() => onSelect(r.id)}
                    />
                  </td>
                )}
                {!compact && <td className="px-2 py-2">{offset + i + 1}</td>}
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.student.code}
                </td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-600">
                      {r.student.full_name
                        .split(/\s+/)
                        .slice(-2)
                        .map((s) => s[0])
                        .join("")}
                    </span>
                    <span className="min-w-24 font-medium text-[#183764] dark:text-slate-100">
                      {r.student.full_name}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2">
                  <StudentStatusBadge row={r} />
                </td>
                <td className="px-2 py-2">
                  <span>{r.classInfo?.name ?? "Chưa ghi danh"}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    {r.classInfo?.code}
                  </span>
                </td>
                {!compact && (
                  <td className="px-2 py-2">{r.student.guardianName ?? "—"}</td>
                )}
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.student.phone ?? "—"}
                </td>
                {!compact && (
                  <td className="px-2 py-2 whitespace-nowrap">
                    {studentDate(r.enrollment?.enrollment_date ?? null)}
                  </td>
                )}
                <td className="px-2 py-2 whitespace-nowrap">
                  {studentDate(r.enrollment?.tuition_end_date ?? null)}
                </td>
                {!compact && (
                  <>
                    <td className="px-2 py-2">
                      {r.enrollment?.registered_sessions ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {r.enrollment?.salesperson ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {r.student.customer_source
                        ? (B2C_CUSTOMER_SOURCE_LABELS[
                            r.student.customer_source
                          ] ?? r.student.customer_source)
                        : "Chưa xác định"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center">
                        <button
                          type="button"
                          aria-label={`Xem hồ sơ ${r.student.full_name}`}
                          onClick={() => setDetail(r)}
                          className="rounded p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="size-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        {canViewHistory && r.enrollment && (
                          <Link
                            href={`/admin/b2c/history?enrollment=${r.enrollment.id}`}
                            aria-label={`Nhật ký thay đổi ${r.student.full_name}`}
                            className="rounded p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <History className="size-4 text-violet-600 dark:text-violet-400" />
                          </Link>
                        )}
                        {r.enrollment && r.classInfo && (
                          <B2CStudentStatusDialog
                            enrollmentId={r.enrollment.id}
                            fullName={r.student.full_name}
                            className={r.classInfo.name}
                            status={r.enrollment.status}
                            reason={r.enrollment.withdrawal_reason}
                            programSlug={r.classInfo.program_slug}
                            phone={r.student.phone}
                            salesperson={r.enrollment.salesperson}
                            enrollmentDate={r.enrollment.enrollment_date}
                            learningStartDate={r.enrollment.learning_start_date}
                            tuitionEndDate={r.enrollment.tuition_end_date}
                            customerSource={r.student.customer_source}
                            referrerName={r.student.referrer_name}
                            learningGoal={r.enrollment.learning_goal}
                            certificateGoal={r.enrollment.certificate_goal}
                          />
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={headings.length + (onSelect ? 1 : 0)}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  Không có học viên phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.student.full_name}</DialogTitle>
            <DialogDescription>
              {detail?.student.code} ·{" "}
              {detail?.classInfo?.name ?? "Chưa ghi danh"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                [
                  "Ngày sinh",
                  detail.student.date_of_birth
                    ? studentDate(detail.student.date_of_birth)
                    : detail.student.birth_year,
                ],
                ["Phụ huynh", detail.student.guardianName],
                ["Điện thoại", detail.student.phone],
                ["Email", detail.student.email],
                ["Địa chỉ", detail.student.address],
                [
                  "Ngày đóng tiền",
                  studentDate(detail.enrollment?.payment_date ?? null),
                ],
                [
                  "Bắt đầu học",
                  studentDate(detail.enrollment?.learning_start_date ?? null),
                ],
                [
                  "Hết học phí",
                  studentDate(detail.enrollment?.tuition_end_date ?? null),
                ],
                ["Lý do nghỉ", detail.enrollment?.withdrawal_reason],
                ["Người giới thiệu", detail.student.referrer_name],
                [
                  "Mục tiêu học",
                  detail.enrollment?.learning_goal
                    ? B2C_LEARNING_GOAL_LABELS[detail.enrollment.learning_goal]
                    : null,
                ],
                ["Chứng chỉ", detail.enrollment?.certificate_goal],
                ["Ghi chú", detail.enrollment?.notes],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
