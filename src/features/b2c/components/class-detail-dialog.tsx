"use client";
import { useState } from "react";
import Link from "next/link";
import { CLASS_TABS, CLASS_WORKSPACE_PATH } from "../domain/class-workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  B2C_STUDENT_STATUS_LABELS,
  B2C_STUDENT_STATUS_COLORS,
} from "../domain/student-status";
import type { ClassRow, StudentRow } from "./program-workspace";
const statuses: Record<string, string> = {
  planned: "Sắp khai giảng",
  active: "Đang học",
  paused: "Tạm dừng",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
const modes: Record<string, string> = {
  offline: "Trực tiếp",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
};
function date(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}
export function B2CClassDetailDialog({
  classRow,
  programTitle,
  students,
  onClose,
}: {
  classRow: ClassRow;
  programTitle: string;
  students: StudentRow[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const q = query.trim().toLocaleLowerCase("vi");
  const matches = students.filter((s) =>
    [s.fullName, s.studentCode, s.phone, s.guardianName].some((v) =>
      v?.toLocaleLowerCase("vi").includes(q),
    ),
  );
  const rows = matches.slice(page * 20, page * 20 + 20);
  const fields = [
    ["Chương trình", programTitle],
    ["Giáo viên", classRow.teacher_name ?? "Chưa phân công"],
    ["Cấp độ", classRow.level_name ?? "Chưa cập nhật"],
    ["Trạng thái", statuses[classRow.status] ?? classRow.status],
    [
      "Lịch học",
      [classRow.weekdays_text, classRow.time_text]
        .filter(Boolean)
        .join(" · ") || "Chưa xếp lịch",
    ],
    ["Ngày khai giảng", date(classRow.start_date)],
    ["Hình thức", modes[classRow.delivery_mode] ?? classRow.delivery_mode],
    ["Cơ sở", classRow.campus ?? "Chưa cập nhật"],
    ["Sĩ số ghi nhận", `${classRow.enrolled_count}/${classRow.capacity}`],
    ["Hồ sơ ghi danh", String(students.length)],
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{classRow.name}</DialogTitle>
          <DialogDescription>
            Mã lớp {classRow.code} · Chi tiết lớp trung tâm (B2C)
          </DialogDescription>
        </DialogHeader>
        <nav
          aria-label="Mở chi tiết lớp đầy đủ"
          className="flex flex-wrap gap-2"
        >
          {Object.entries(CLASS_TABS).map(([tab, label]) => (
            <DialogClose asChild key={tab}>
              <Button asChild variant="outline">
                <Link
                  href={`${CLASS_WORKSPACE_PATH}/${classRow.id}?tab=${tab}`}
                >
                  {label}
                </Link>
              </Button>
            </DialogClose>
          ))}
        </nav>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="mt-1 text-sm font-medium break-words whitespace-pre-wrap">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {classRow.notes && (
          <section className="rounded-lg border p-3">
            <h2 className="text-sm font-semibold">Ghi chú lớp</h2>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">
              {classRow.notes}
            </p>
          </section>
        )}
        <section>
          <h2 className="mb-3 font-semibold">
            Danh sách học viên của lớp ({students.length})
          </h2>
          <Input
            type="search"
            aria-label="Tìm học viên trong lớp"
            placeholder="Tìm mã, tên, SĐT hoặc phụ huynh…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="mb-3"
          />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">
                Học viên lớp {classRow.name}
              </caption>
              <thead className="bg-muted/60">
                <tr>
                  {[
                    "Mã học viên",
                    "Họ tên",
                    "Trạng thái",
                    "Phụ huynh",
                    "Điện thoại",
                    "Ngày nhập học",
                    "Hết học phí",
                    "Số buổi đăng ký",
                  ].map((h) => (
                    <th scope="col" key={h} className="p-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{s.studentCode}</td>
                    <td className="p-3 font-medium">{s.fullName}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs whitespace-nowrap ${B2C_STUDENT_STATUS_COLORS[s.studentStatus]}`}
                      >
                        {B2C_STUDENT_STATUS_LABELS[s.studentStatus]}
                      </span>
                    </td>
                    <td className="p-3">{s.guardianName ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">{s.phone ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      {date(s.enrollmentDate)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {date(s.tuitionEndDate)}
                    </td>
                    <td className="p-3">{s.registeredSessions ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="text-muted-foreground p-5 text-center">
                {q
                  ? "Không tìm thấy học viên phù hợp."
                  : "Lớp chưa có hồ sơ học viên."}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              {matches.length} hồ sơ · Trang {page + 1}/
              {Math.max(1, Math.ceil(matches.length / 20))}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                disabled={(page + 1) * 20 >= matches.length}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
