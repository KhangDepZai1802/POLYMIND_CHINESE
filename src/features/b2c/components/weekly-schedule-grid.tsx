import { Clock3, GraduationCap, Repeat2 } from "lucide-react";
import { WEEKLY_DAYS, readWeeklySlots } from "../domain/weekly-schedule";

export function WeeklyScheduleGrid({
  weekdays,
  time,
  teacher,
}: {
  weekdays: string | null;
  time: string | null;
  teacher: string | null;
}) {
  const slots = readWeeklySlots(weekdays, time);
  const selected = new Set(slots.map((s) => s.day));
  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-xl border">
      <div
        className="focus-visible:ring-primary relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-none"
        tabIndex={0}
        role="region"
        aria-label="Lịch học hằng tuần từ thứ Hai đến Chủ nhật, cuộn ngang để xem đủ tuần"
      >
        <div className="grid min-w-[56rem] grid-cols-7 divide-x">
          {WEEKLY_DAYS.map((day) => (
            <section
              key={day}
              aria-label={day === "CN" ? "Chủ nhật" : `Thứ ${day.slice(1)}`}
              className="min-w-0"
            >
              <h3
                className={`border-b px-3 py-3 text-center text-sm font-semibold ${selected.has(day) ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted/40 text-muted-foreground"}`}
              >
                {day}
              </h3>
              <div className="min-h-44 p-2">
                {selected.has(day) ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 shadow-sm dark:border-blue-900 dark:bg-blue-950/30">
                    <p className="flex items-start gap-1.5 text-sm font-semibold">
                      <Clock3
                        className="mt-0.5 size-3.5 shrink-0 text-blue-600"
                        aria-hidden
                      />
                      <span className="break-words">
                        {(() => {
                          const slot = slots.find((s) => s.day === day);
                          return slot?.start_time && slot.end_time
                            ? `${slot.start_time}–${slot.end_time}`
                            : "Chưa nhập giờ học";
                        })()}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
                      <GraduationCap
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                      <span className="break-words">
                        {teacher?.trim() || "Chưa phân công giáo viên"}
                      </span>
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      <Repeat2 className="size-3" aria-hidden />
                      Hằng tuần
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    Không có lịch tuần
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
