"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Phone,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { CareLogDialog } from "@/features/b2c/components/care-log-dialog";
import {
  TASK_GROUPS,
  type TaskGroup,
  type TodayTask,
} from "../domain/today-tasks";

const GROUP_STYLE = {
  callback: {
    icon: Phone,
    color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  },
  tuition: {
    icon: CreditCard,
    color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  },
  ending: {
    icon: GraduationCap,
    color:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  },
  attendance: {
    icon: UserRound,
    color: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  },
} as const;
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi");

export function TodayTasks({
  tasks,
  today,
  refreshedAt,
}: {
  tasks: TodayTask[];
  today: string;
  refreshedAt?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [group, setGroup] = useState<TaskGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const counts = Object.fromEntries(
    Object.keys(TASK_GROUPS).map((key) => [
      key,
      tasks.filter((t) => t.group === key).length,
    ]),
  );
  const filtered = tasks.filter(
    (t) =>
      (group === "all" || t.group === group) &&
      `${t.title} ${t.detail}`
        .toLocaleLowerCase("vi")
        .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  const selectGroup = (next: TaskGroup | "all") => {
    setGroup(next);
    setPage(0);
  };
  return (
    <section
      aria-label="Danh sách việc cần xử lý hôm nay"
      className="min-w-0 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <CalendarDays className="size-4" aria-hidden />
          <span>Ngày {dateLabel(today)} - Giờ Việt Nam</span>
          <span aria-hidden>|</span>
          <span>{tasks.length} việc cần xử lý</span>
        </p>
        <div className="space-y-1 text-right">
          <Button
            variant="outline"
            disabled={pending}
            className="bg-card dark:border-border min-h-11 rounded-xl border-blue-100 shadow-sm"
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw
              className={`size-4 ${pending ? "animate-spin" : ""}`}
              aria-hidden
            />
            {pending ? "Đang cập nhật…" : "Cập nhật"}
          </Button>
          {refreshedAt && (
            <p className="text-muted-foreground text-[11px]">
              Cập nhật lần cuối:{" "}
              {new Intl.DateTimeFormat("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(refreshedAt))}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(TASK_GROUPS) as [TaskGroup, string][]).map(
          ([key, label]) => {
            const { icon: Icon, color } = GROUP_STYLE[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={group === key}
                onClick={() => selectGroup(group === key ? "all" : key)}
                className={`bg-card focus-visible:ring-primary flex min-w-0 items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${group === key ? "border-primary ring-primary/15 ring-1" : "dark:border-border border-blue-100 hover:border-blue-300"}`}
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${color}`}
                >
                  <Icon className="size-7" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-sm">
                    {label}
                  </span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums">
                    {counts[key]}
                  </span>
                </span>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              </button>
            );
          },
        )}
      </div>
      <div className="bg-card dark:border-border min-w-0 rounded-2xl border border-blue-100 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <ClipboardList
              className="mt-1 size-6 shrink-0 text-blue-600"
              aria-hidden
            />
            <div>
              <h2 className="text-base font-bold">Danh sách công việc</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Gọi lại và học phí: đến hạn hoặc quá hạn. Lớp sắp kết thúc: 14
                ngày tới. Điểm danh: buổi đã kết thúc.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm" role="status">
            Tổng {filtered.length} việc
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" aria-label="Lọc loại công việc">
            <Button
              className="rounded-full px-5"
              variant={group === "all" ? "default" : "outline"}
              aria-pressed={group === "all"}
              onClick={() => selectGroup("all")}
            >
              Tất cả ({tasks.length})
            </Button>
            {(Object.entries(TASK_GROUPS) as [TaskGroup, string][])
              .filter(([key]) => counts[key] || group === key)
              .map(([key, label]) => (
                <Button
                  key={key}
                  className="rounded-full"
                  variant={group === key ? "default" : "outline"}
                  aria-pressed={group === key}
                  onClick={() => selectGroup(key)}
                >
                  {label}
                </Button>
              ))}
            <span className="text-muted-foreground dark:border-border dark:bg-muted inline-flex items-center rounded-full border border-blue-100 bg-blue-50/70 px-4 py-2 text-xs">
              Trung tâm
            </span>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
              aria-hidden
            />
            <Input
              aria-label="Tìm công việc"
              placeholder="Tìm tên, mã học viên, lớp, người phụ trách…"
              className="dark:border-border dark:bg-background rounded-xl border-blue-100 bg-blue-50/20 pl-10"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <CheckCheck
              className="text-primary mx-auto mb-3 size-8"
              aria-hidden
            />
            <p className="font-medium">
              {tasks.length
                ? "Không có công việc phù hợp bộ lọc."
                : "Hiện không có công việc cần xử lý."}
            </p>
          </div>
        ) : (
          <div className="dark:border-border overflow-hidden rounded-lg border border-blue-100">
            <DataTable
              caption="Công việc cần xử lý của trung tâm"
              minWidthClass="min-w-[48rem]"
            >
              <DataTableHeader className="dark:bg-muted bg-blue-50/60">
                <DataTableRow>
                  <DataTableHead
                    sticky
                    className="dark:bg-muted w-[42%] bg-blue-50"
                  >
                    Học viên / Lớp học
                  </DataTableHead>
                  <DataTableHead>Loại việc</DataTableHead>
                  <DataTableHead>Hạn xử lý</DataTableHead>
                  <DataTableHead className="text-right">Thao tác</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {filtered.slice(current * 20, current * 20 + 20).map((t) => {
                  const name = t.displayName ?? t.title;
                  return (
                    <DataTableRow key={t.id}>
                      <DataTableCell sticky>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {initials(name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">{name}</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {t.studentCode && (
                                <>
                                  <span>{t.studentCode}</span>
                                  <span aria-hidden> · </span>
                                </>
                              )}
                              {t.detail}
                            </p>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs ${GROUP_STYLE[t.group].color}`}
                          >
                            {TASK_GROUPS[t.group]}
                          </span>
                          <span className="bg-muted text-muted-foreground rounded-md px-2.5 py-1 text-xs">
                            Trung tâm
                          </span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <span
                          className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap ${t.date < today ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"}`}
                        >
                          <CalendarDays className="size-3.5" aria-hidden />
                          {t.date < today
                            ? "Quá hạn: "
                            : t.date === today
                              ? "Hôm nay: "
                              : "Sắp đến: "}
                          {dateLabel(t.date)}
                        </span>
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <div className="ml-auto w-40">
                          <Button
                            asChild
                            className="min-h-10 w-full rounded-lg"
                          >
                            <Link href={t.href}>{t.action}</Link>
                          </Button>
                          {t.lead && (
                            <CareLogDialog
                              leadId={t.lead.id}
                              fullName={t.lead.name}
                              caretaker={t.lead.caretaker}
                            />
                          )}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Trước
            </Button>
            <span className="text-muted-foreground text-sm">
              Trang {current + 1}/{pages}
            </span>
            <Button
              variant="outline"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Sau
            </Button>
          </div>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          Học phí hiển thị theo hạn gia hạn của ghi danh. Bấm Cập nhật sau khi
          xử lý để tính lại danh sách.
        </p>
      </div>
    </section>
  );
}
