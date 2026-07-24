import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";

import { AttendanceRoster } from "@/features/attendance/components/attendance-roster";
import { getAttendanceSheet } from "@/features/attendance/server/queries";
import {
  getSessionsNeedingAttendance,
  getTeacherSessionsToday,
} from "@/features/dashboard/server/teacher-queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Điểm danh" };

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  await requireRole("teacher", "super_admin");
  const { session: sessionId } = await searchParams;

  // --- Chưa chọn buổi → cho chọn -------------------------------------------
  if (!sessionId) {
    const [today, needAttendance] = await Promise.all([
      getTeacherSessionsToday(),
      getSessionsNeedingAttendance(20),
    ]);

    const seen = new Set<string>();
    const options = [...today, ...needAttendance].filter((s) => {
      if (seen.has(s.id) || s.isFullyMarked) return false;
      seen.add(s.id);
      return true;
    });

    return (
      <>
        <PageHeader
          title="Điểm danh"
          description="Chọn buổi cần điểm danh. Chỉ hiện buổi của lớp bạn dạy."
        />

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {options.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Không còn buổi nào cần điểm danh"
                description="Mọi buổi đã dạy đều đã điểm danh đủ."
              />
            ) : (
              <ul className="divide-y">
                {options.map((s) => (
                  <li key={s.id}>
                    {/* Nút "Điểm danh" là <span>, KHÔNG phải <button>: HTML cấm
                        interactive content bên trong <a>, và một hàng có hai
                        điểm dừng Tab trỏ cùng một đích thì trình đọc màn hình
                        đọc thành "link … button" cho một hành động duy nhất. */}
                    <Link
                      href={`/teacher/attendance?session=${s.id}`}
                      className="hover:bg-primary-50 focus-visible:ring-ring flex flex-wrap items-center justify-between gap-3 p-4 focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="font-mono text-sm">
                            {s.classCode}
                          </span>{" "}
                          · Buổi {s.sessionNumber}
                        </p>
                        <p className="text-text-secondary text-sm">
                          {formatDate(s.startsAt)} · {formatTime(s.startsAt)}–
                          {formatTime(s.endsAt)} · đã điểm danh {s.marked}/
                          {s.expected}
                        </p>
                      </div>
                      <span
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Điểm danh
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  // --- Điểm danh một buổi ---------------------------------------------------
  //
  // `getAttendanceSheet` trả `null` khi RLS không cho đọc → giáo viên đoán URL
  // của buổi thuộc lớp người khác cũng chỉ nhận 404. Không có lớp kiểm quyền
  // nào ở app; chốt chặn nằm ở DB.
  const sheet = await getAttendanceSheet(sessionId);
  if (!sheet) notFound();

  return (
    <>
      <Link
        href="/teacher"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Về Hôm nay
      </Link>

      <PageHeader
        title={`Điểm danh · Buổi ${sheet.sessionNumber}`}
        description={`${sheet.classCode} — ${sheet.className}`}
        action={
          <Button asChild variant="outline">
            <Link href={`/teacher/sessions/${sheet.id}`}>
              <BookOpenCheck className="size-4" aria-hidden />
              Nhật ký buổi
            </Link>
          </Button>
        }
      />

      {/* Đây là MỘT DÒNG METADATA, không phải tiêu đề — nên dùng <p> trong
          CardContent chứ không mượn CardTitle rồi ghi đè font của nó. */}
      <Card className="mb-5">
        <CardContent className="py-4">
          <p className="text-text-secondary flex items-center gap-2 text-sm">
            <CalendarClock className="size-4" aria-hidden />
            {formatDate(sheet.startsAt)} · {formatTime(sheet.startsAt)}–
            {formatTime(sheet.endsAt)}
          </p>
        </CardContent>
      </Card>

      {sheet.roster.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CheckCircle2}
              title="Lớp chưa có học viên nào đang học"
              description="Chỉ điểm danh học viên có ghi danh đang mở. Học viên đã rút không hiện ở đây."
            />
          </CardContent>
        </Card>
      ) : (
        <AttendanceRoster sessionId={sheet.id} roster={sheet.roster} />
      )}
    </>
  );
}
