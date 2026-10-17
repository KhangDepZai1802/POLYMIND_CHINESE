"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Clock3, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableBody,
  DataTableCell,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEKLY_DAYS } from "../domain/weekly-schedule";
import type { buildTeacherTimetable } from "../domain/teacher-timetable";
type Model = ReturnType<typeof buildTeacherTimetable>;
const COLORS = [
  "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
  "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100",
  "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
];
export function TeacherTimetable({ data }: { data: Model }) {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  const [teacher, setTeacher] = useState("all"),
    [query, setQuery] = useState("");
  const match = (item: {
    teacherKey: string;
    name: string;
    code: string;
    teacherName: string;
  }) =>
    (teacher === "all" || item.teacherKey === teacher) &&
    `${item.name} ${item.code} ${item.teacherName}`
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi"));
  const lessons = data.lessons.filter(match),
    incomplete = data.incomplete.filter(match);
  const times = [...new Set(lessons.map((l) => l.start))].sort();
  const minutes = lessons.reduce(
    (sum, l) =>
      sum +
      Number(l.end.slice(0, 2)) * 60 +
      Number(l.end.slice(3)) -
      Number(l.start.slice(0, 2)) * 60 -
      Number(l.start.slice(3)),
    0,
  );
  const totalClasses = new Set([
    ...lessons.map((l) => l.classId),
    ...incomplete.map((l) => l.classId),
  ]).size;
  return (
    <>
      <PageHeader
        title="Thời khóa biểu giáo viên"
        description="Xem lịch dạy cố định hằng tuần theo giáo viên, lớp và khung giờ. Không cần ngày bắt đầu hoặc kết thúc."
      />
      <div className="bg-card mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="grid min-w-0 flex-1 gap-2 text-sm sm:max-w-xs">
          <span className="font-medium">Giáo viên</span>
          <select
            className="bg-background min-h-11 w-full rounded-lg border px-3"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
          >
            <option value="all">Tất cả giáo viên</option>
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 flex-1 gap-2 text-sm sm:max-w-sm">
          <span className="font-medium">Tìm lớp / giáo viên</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên lớp, mã lớp, giáo viên…"
            className="min-h-11"
          />
        </label>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshCw
            className={`size-4 ${pending ? "animate-spin" : ""}`}
            aria-hidden
          />
          {pending ? "Đang cập nhật…" : "Cập nhật"}
        </Button>
      </div>
      <div
        className="mb-4 grid gap-3 sm:grid-cols-3"
        aria-label="Tổng quan lịch tuần"
      >
        {[
          ["Lớp đang học / dự kiến", totalClasses],
          ["Ca dạy mỗi tuần", lessons.length],
          [
            "Giờ dạy dự kiến / tuần",
            (minutes / 60).toLocaleString("vi-VN", {
              maximumFractionDigits: 2,
            }),
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-xl border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {lessons.some((l) => l.conflict) && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Có khung giờ trùng của cùng giáo viên. Các thẻ màu đỏ cần được kiểm
          tra lại; lịch dự kiến cũng được tính.
        </p>
      )}
      <section
        aria-label="Thời khóa biểu dạy hằng tuần"
        className="bg-card min-w-0 overflow-hidden rounded-xl border"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarDays className="text-primary size-5" aria-hidden />
            {teacher === "all"
              ? "Lịch dạy toàn trung tâm"
              : data.teachers.find((t) => t.id === teacher)?.full_name}
          </h2>
          <p className="text-muted-foreground text-xs">
            Giờ Việt Nam · Lịch tuần · Vuốt ngang để xem đủ T2–CN
          </p>
        </div>
        {!lessons.length ? (
          <p className="text-muted-foreground p-8 text-center">
            Chưa có lịch tuần hợp lệ phù hợp với lựa chọn này.
          </p>
        ) : (
          <DataTable
            caption="Thời khóa biểu giáo viên theo giờ bắt đầu và thứ học"
            minWidthClass="min-w-[72rem]"
          >
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead sticky>Giờ bắt đầu</DataTableHead>
                {WEEKLY_DAYS.map((day) => (
                  <DataTableHead
                    key={day}
                    className="min-w-36 border-l text-center"
                  >
                    {day}
                  </DataTableHead>
                ))}
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {times.map((time) => (
                <DataTableRow key={time}>
                  <DataTableCell
                    sticky
                    className="w-24 align-top font-semibold"
                  >
                    {time}
                  </DataTableCell>
                  {WEEKLY_DAYS.map((day) => (
                    <DataTableCell key={day} className="border-l p-2 align-top">
                      <div className="min-h-20 space-y-2">
                        {lessons
                          .filter((l) => l.day === day && l.start === time)
                          .map((l) => {
                            const color =
                              COLORS[
                                Math.max(
                                  0,
                                  data.teachers.findIndex(
                                    (t) => t.id === l.teacherKey,
                                  ),
                                ) % COLORS.length
                              ];
                            return (
                              <Link
                                key={l.id}
                                href={`/admin/b2c/classes/${l.classId}?tab=schedule`}
                                className={`focus-visible:ring-primary block rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${l.conflict ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100" : color}`}
                              >
                                <p className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                                  <Clock3
                                    className="size-3 shrink-0"
                                    aria-hidden
                                  />
                                  {l.start}–{l.end}
                                </p>
                                <p className="mt-2 text-sm font-bold">
                                  {l.name}
                                </p>
                                <p className="mt-1 text-xs">{l.code}</p>
                                <p className="mt-2 text-xs font-medium">
                                  {l.teacherName}
                                </p>
                                {l.campus && (
                                  <p className="mt-1 text-xs">{l.campus}</p>
                                )}
                                {l.status === "planned" && (
                                  <p className="mt-2 text-xs">Lớp dự kiến</p>
                                )}
                                {l.conflict && (
                                  <p className="mt-2 text-xs font-bold">
                                    Trùng giờ giáo viên
                                  </p>
                                )}
                              </Link>
                            );
                          })}
                      </div>
                    </DataTableCell>
                  ))}
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>
      {!!incomplete.length && (
        <section className="bg-card mt-4 rounded-xl border p-4">
          <h2 className="font-semibold">
            Lớp cần bổ sung thông tin lịch ({incomplete.length})
          </h2>
          <ul className="mt-3 divide-y">
            {incomplete.map((c) => (
              <li
                key={c.classId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {c.code} · {c.name} · {c.teacherName}
                  </p>
                  <p className="text-muted-foreground mt-1">{c.reason}</p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/admin/b2c/classes/${c.classId}?tab=schedule`}>
                    Sửa lịch tuần
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-muted-foreground mt-4 text-xs">
        Số giờ là tổng lịch tuần dự kiến của các lớp đang học và dự kiến; không
        phải chấm công hay tiền lương. Bấm thẻ lớp để mở chi tiết. Lớp tạm dừng,
        kết thúc hoặc hủy không hiển thị.
      </p>
    </>
  );
}
