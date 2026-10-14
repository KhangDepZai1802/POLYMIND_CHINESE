"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Row } from "@/features/b2c/components/teacher-dashboard";

export type TeacherSummaryKind = "all" | "teaching" | "waiting" | "classes";
const titles: Record<TeacherSummaryKind, string> = {
  all: "Tổng giáo viên",
  teaching: "Giáo viên có lịch dạy",
  waiting: "Giáo viên chưa có lịch dạy",
  classes: "Danh sách lớp phụ trách",
};

export function TeacherSummaryDialog({
  kind,
  rows,
  month,
  onClose,
  restoreFocus,
}: {
  kind: TeacherSummaryKind;
  rows: Row[];
  month: string;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const group = rows.filter((r) =>
    kind === "teaching"
      ? r.teachingMonths.includes(month)
      : kind === "waiting"
        ? !r.teachingMonths.includes(month)
        : true,
  );
  const classes = kind === "classes";
  const entries = classes
    ? group.flatMap((r) =>
        r.assignedClasses.map((c) => ({
          id: c.id,
          name: c.name,
          teacher: r.teacher.full_name,
          contact: c.code,
          specialization: "",
          count: c.studentCount,
        })),
      )
    : group.map((r) => ({
        id: r.teacher.id,
        name: r.teacher.full_name,
        teacher: "",
        contact:
          [r.teacher.phone, r.teacher.email].filter(Boolean).join(" · ") || "—",
        specialization: r.teacher.specialization || "Chưa cập nhật",
        count: r.classCount,
      }));
  const filtered = entries.filter((e) =>
    `${e.name} ${e.teacher} ${e.contact} ${e.specialization}`
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {titles[kind]} ({entries.length})
          </DialogTitle>
          <DialogDescription>
            {kind === "teaching" || kind === "waiting"
              ? `Theo lịch dạy tháng ${month.slice(5)}/${month.slice(0, 4)}.`
              : "Danh sách lũy kế."}{" "}
            Áp dụng bộ lọc chuyên môn đang chọn.
          </DialogDescription>
        </DialogHeader>
        <label className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-blue-600 dark:text-blue-400" />
          <input
            autoComplete="off"
            aria-label={
              classes ? "Tìm lớp trong popup" : "Tìm giáo viên trong popup"
            }
            placeholder={
              classes
                ? "Tìm tên lớp, mã lớp, giáo viên…"
                : "Tìm giáo viên, liên hệ, chuyên môn…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="border-input bg-background h-10 w-full rounded-md border pr-3 pl-9 text-sm"
          />
        </label>
        <div className="min-w-0 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[540px] text-left text-sm">
            <caption className="sr-only">{titles[kind]}</caption>
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {(classes
                  ? ["#", "Lớp học", "Mã lớp", "Giáo viên", "Sĩ số"]
                  : ["#", "Giáo viên", "Liên hệ", "Chuyên môn", "Số lớp"]
                ).map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((e, i) => (
                <tr key={e.id} className="border-t">
                  <td className="text-muted-foreground px-3 py-3">
                    {currentPage * 20 + i + 1}
                  </td>
                  <td className="px-3 py-3 font-medium">{e.name}</td>
                  <td className="px-3 py-3 break-words">{e.contact}</td>
                  <td className="px-3 py-3">
                    {classes ? e.teacher : e.specialization}
                  </td>
                  <td className="px-3 py-3">{e.count ?? "—"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground px-3 py-10 text-center"
                  >
                    {query
                      ? "Không có kết quả phù hợp."
                      : classes
                        ? "Chưa có lớp phụ trách."
                        : "Không có giáo viên trong nhóm này."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <span>
            {filtered.length} {classes ? "lớp" : "giáo viên"} · Trang{" "}
            {currentPage + 1}/{pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Trang trước trong popup"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-md border p-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Trang sau trong popup"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-md border p-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
