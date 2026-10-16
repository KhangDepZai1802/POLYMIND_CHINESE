import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  TeacherB2CClass,
  TeacherB2CMeetingToday,
} from "@/features/b2c/server/teacher-class-queries";
import { formatTime } from "@/lib/dates";

export function TeacherB2CTodayClasses({
  classes,
  meetings = [],
}: {
  classes: TeacherB2CClass[];
  meetings?: TeacherB2CMeetingToday[];
}) {
  if (!classes.length && !meetings.length) return null;
  return (
    <section aria-label="Lịch B2C hôm nay theo lịch tuần">
      {!!meetings.length && (
        <>
          <p className="sr-only">Buổi học B2C hôm nay</p>
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <span className="text-sm font-medium tabular-nums">
                  {formatTime(m.starts_at)}–{formatTime(m.ends_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m.code} · {m.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {m.room_name || "Chưa xếp phòng"} ·{" "}
                    {m.status === "cancelled"
                      ? "Đã hủy"
                      : m.status === "completed"
                        ? "Đã học"
                        : "Theo lịch"}
                  </p>
                </div>
                <Button asChild size="sm" className="min-h-11 w-full sm:min-h-8 sm:w-auto">
                  <Link
                    href={`/teacher/b2c-classes/${m.class_id}?tab=schedule`}
                  >
                    Xem buổi học
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {!!classes.length && (
        <p className="text-muted-foreground px-6 pt-4 text-sm">
          Lớp trung tâm B2C · Theo lịch tuần
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {classes.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <span className="min-w-24 text-sm font-medium tabular-nums">
              {item.time_text || "Chưa cập nhật giờ"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium">{item.code}</p>
              <p className="font-medium break-words">{item.name}</p>
              <p className="text-muted-foreground text-sm">
                {item.weekdays_text} · {item.student_count} học viên
              </p>
            </div>
            <Button asChild size="sm" className="min-h-11 w-full sm:min-h-8 sm:w-auto">
              <Link href={`/teacher/b2c-classes/${item.id}?tab=schedule`}>
                Xem lịch lớp
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      {!!classes.length && <p className="text-muted-foreground px-3 pt-3 text-xs">
        Lịch tuần là lịch dự kiến. Chấm công theo buổi được phân công tại mục
        Chấm công.
      </p>}
    </section>
  );
}
