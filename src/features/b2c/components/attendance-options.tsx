import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/dates";
import type { B2CAttendanceOptions } from "../server/attendance-options";
export function B2CAttendanceOptionsPanel({
  data,
}: {
  data: B2CAttendanceOptions | null;
}) {
  if (!data) return null;
  return (
    <section
      aria-label="Điểm danh lớp trung tâm hôm nay"
      className="bg-card mb-5 overflow-hidden rounded-xl border"
    >
      <div className="border-b p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ClipboardCheck className="text-primary size-5" aria-hidden />
          Lớp trung tâm · Hôm nay
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Chọn buổi học để điểm danh học viên của lớp được phân công.
        </p>
      </div>
      {!data.allowed ? (
        <p className="p-4 text-sm">
          Bạn chưa được cấp quyền điểm danh học viên lớp trung tâm. Liên hệ quản
          lý để được cấp quyền.
        </p>
      ) : !data.meetings.length ? (
        <p className="text-muted-foreground p-4 text-sm">
          Chưa có buổi học theo ngày hôm nay để điểm danh. Lịch tuần chưa tạo
          buổi cụ thể sẽ không xuất hiện tại đây.
        </p>
      ) : (
        <ul className="divide-y">
          {data.meetings.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-semibold">
                  {m.code} · {m.name}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatDate(m.starts_at)} · {formatTime(m.starts_at)}–
                  {formatTime(m.ends_at)}
                </p>
              </div>
              <Button asChild className="min-h-11">
                <Link
                  href={`/teacher/b2c-classes/${m.class_id}?tab=attendance&meeting=${m.id}`}
                >
                  Điểm danh học viên
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {data.allowed && (
        <div className="border-t p-4 text-sm">
          <Link href="/teacher/classes" className="text-primary underline">
            Mở Lớp của tôi để xem lịch và điểm danh buổi khác
          </Link>
        </div>
      )}
    </section>
  );
}
