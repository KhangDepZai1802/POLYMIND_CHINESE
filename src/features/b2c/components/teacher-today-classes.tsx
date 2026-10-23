import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  TeacherB2CClass,
  TeacherB2CMeetingToday,
} from "@/features/b2c/server/teacher-class-queries";
import { formatTime } from "@/lib/dates";
import { Camera, ClipboardCheck, LogOut } from "lucide-react";

export function TeacherB2CTodayClasses({
  classes,
  meetings = [],
  canMarkAttendance = false,
  canCheckTeaching = false,
}: {
  classes: TeacherB2CClass[];
  meetings?: TeacherB2CMeetingToday[];
  canMarkAttendance?: boolean;
  canCheckTeaching?: boolean;
}) {
  if (!classes.length && !meetings.length) return null;
  return (
    <section aria-label="Lịch hôm nay theo lịch tuần">
      {!!meetings.length && (
        <>
          <p className="sr-only">Buổi học hôm nay</p>
          <ul className="space-y-3">
            {meetings.map((m) => {
              const now = Date.now();
              const opensAt = new Date(m.starts_at).getTime() - 15 * 60_000;
              const endsAt = new Date(m.ends_at).getTime();
              const checkinOpen = now >= opensAt && now < endsAt;
              const checkedIn = Boolean(m.check_in_at);
              const checkedOut = Boolean(m.check_out_at);
              const studentCount = m.student_count ?? 0;
              const attendanceMarked = m.attendance_marked ?? 0;
              const attendanceDone = studentCount > 0 && attendanceMarked >= studentCount;
              return (
              <li
                key={m.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-4 shadow-sm ${checkedOut ? "border-emerald-200 bg-emerald-50/40" : checkedIn ? "border-orange-300 bg-orange-50/60" : checkinOpen ? "border-red-400 bg-red-50/70" : "border-blue-100 bg-blue-50/30"} dark:border-slate-700 dark:bg-slate-800`}
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
                  <p className={`mt-1 text-xs font-semibold ${checkedOut ? "text-emerald-700" : checkedIn ? "text-orange-700" : checkinOpen ? "text-red-700" : "text-blue-700"}`}>
                    {checkedOut ? "Đã check-out · Hoàn tất buổi dạy" : checkedIn ? `Đã check-in · Điểm danh ${attendanceMarked}/${studentCount} học viên` : checkinOpen ? "Đã đến giờ · Cần check-in xác nhận có mặt" : `Check-in mở lúc ${formatTime(new Date(opensAt).toISOString())}`}
                  </p>
                </div>
                {canCheckTeaching && !checkedIn && m.status !== "cancelled" && checkinOpen && (
                  <Button
                    asChild
                    size="lg"
                    className="min-h-12 w-full bg-red-600 text-base font-bold hover:bg-red-700 sm:w-auto"
                  >
                    <Link href="/teacher/b2c-teaching"><Camera className="size-5" aria-hidden />CHECK-IN NGAY</Link>
                  </Button>
                )}
                {canMarkAttendance && checkedIn && !attendanceDone && m.status !== "cancelled" && <Button asChild size="lg" className="min-h-12 w-full bg-orange-600 text-base font-bold hover:bg-orange-700 sm:w-auto"><Link href={`/teacher/b2c-classes/${m.class_id}?tab=attendance&meeting=${m.id}`}><ClipboardCheck className="size-5" aria-hidden />ĐIỂM DANH HỌC VIÊN</Link></Button>}
                {canCheckTeaching && checkedIn && !checkedOut && now >= endsAt && <Button asChild size="lg" className="min-h-12 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-700 sm:w-auto"><Link href="/teacher/b2c-teaching"><LogOut className="size-5" aria-hidden />CHECK-OUT NGAY</Link></Button>}
                {checkedIn && attendanceDone && !checkedOut && now < endsAt && <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">Đã điểm danh đủ · Check-out từ {formatTime(m.ends_at)}</span>}
              </li>
            )})}
          </ul>
        </>
      )}
      {!!classes.length && (
        <p className="text-muted-foreground px-6 pt-4 text-sm">
          Lớp trung tâm · Theo lịch tuần
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
            <Button
              asChild
              size="sm"
              className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            >
              <Link href={`/teacher/b2c-classes/${item.id}?tab=schedule`}>
                Xem lịch lớp
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      {!!classes.length && (
        <p className="text-muted-foreground px-3 pt-3 text-xs">
          Buổi theo lịch tuần hôm nay cũng hiển thị tại mục Chấm công. Check-in
          mở trước giờ dạy 15 phút.
        </p>
      )}
    </section>
  );
}
