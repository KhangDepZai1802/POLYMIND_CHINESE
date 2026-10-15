import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TeacherB2CClass } from "@/features/b2c/server/teacher-class-queries";

export function TeacherB2CClassCards({
  classes,
  compact = false,
}: {
  classes: TeacherB2CClass[];
  compact?: boolean;
}) {
  if (!classes.length) return null;
  return (
    <section
      className="space-y-3"
      aria-label="Lớp trung tâm B2C được phân công"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#102752] dark:text-white">
          <GraduationCap
            className="size-5 text-blue-600 dark:text-blue-400"
            aria-hidden
          />
          Lớp trung tâm B2C ({classes.length})
        </h2>
        {compact && (
          <Link
            href="/teacher/classes"
            className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Xem tất cả
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div
        className={`grid gap-3 sm:grid-cols-2 ${compact ? "xl:grid-cols-4" : "lg:grid-cols-2"}`}
      >
        {classes.map((item, index) => (
          <Link
            key={item.id}
            href={`/teacher/b2c-classes/${item.id}`}
            className="focus-visible:ring-ring block min-w-0 rounded-xl focus-visible:ring-2"
          >
            <Card className="h-full gap-0 border-blue-100 bg-white py-0 shadow-[0_3px_14px_-8px_rgba(30,80,160,0.22)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${["bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400", "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400", "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400", "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"][index % 4]}`}
                    >
                      <BookOpen className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.code}
                      </span>{" "}
                      <span
                        role="heading"
                        aria-level={3}
                        className="block text-sm font-semibold break-words text-[#102752] dark:text-white"
                      >
                        {item.name}
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    className="size-7 shrink-0 rounded-full border border-blue-100 p-1 text-blue-600 dark:border-slate-700 dark:text-blue-400"
                    aria-hidden
                  />
                </div>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Users
                    className="size-4 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  {item.student_count === undefined
                    ? "Sĩ số chưa được cấp quyền xem"
                    : `${item.student_count} học viên`}
                </p>
                <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed break-words">
                  <CalendarDays
                    className="mt-0.5 size-4 shrink-0 text-slate-500 dark:text-slate-400"
                    aria-hidden
                  />
                  {[item.weekdays_text, item.time_text]
                    .filter(Boolean)
                    .join(" · ") || "Chưa cập nhật lịch học"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
