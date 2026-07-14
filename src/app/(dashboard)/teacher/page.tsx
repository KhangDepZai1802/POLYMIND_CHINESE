import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  School,
} from "lucide-react";

import {
  getMyClasses,
  getPendingGrading,
  getSessionsNeedingAttendance,
  getTeacherAtRiskStudents,
  getTeacherSessionsToday,
} from "@/features/dashboard/server/teacher-queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Hôm nay" };

export default async function TeacherDashboardPage() {
  const user = await requireRole("teacher");

  const [today, needAttendance, pendingGrading, atRisk, myClasses] =
    await Promise.all([
      getTeacherSessionsToday(),
      getSessionsNeedingAttendance(),
      getPendingGrading(),
      getTeacherAtRiskStudents(),
      getMyClasses(),
    ]);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Lịch dạy hôm nay, buổi chưa điểm danh và bài chờ chấm."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <div className="space-y-5">
          {/* --- Lịch dạy hôm nay --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4" aria-hidden />
                Lịch dạy hôm nay ({today.length})
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Giờ hiển thị theo múi giờ Việt Nam.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {today.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Hôm nay bạn không có buổi dạy"
                  description="Xem toàn bộ lớp của bạn ở danh sách bên cạnh."
                />
              ) : (
                <ul className="divide-y border-t">
                  {today.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-4"
                    >
                      <span className="w-24 shrink-0 text-sm font-medium tabular-nums">
                        {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          <span className="font-mono text-xs">
                            {s.classCode}
                          </span>{" "}
                          · Buổi {s.sessionNumber}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {s.topic ?? s.className}
                        </p>
                      </div>

                      {s.isFullyMarked ? (
                        <span className="text-success flex shrink-0 items-center gap-1 text-xs">
                          <CheckCircle2 className="size-4" aria-hidden />
                          Đã điểm danh {s.marked}/{s.expected}
                        </span>
                      ) : (
                        <Button asChild size="sm" className="shrink-0">
                          <Link href={`/teacher/attendance?session=${s.id}`}>
                            <ClipboardCheck className="size-4" aria-hidden />
                            Điểm danh{" "}
                            {s.expected > 0 ? `${s.marked}/${s.expected}` : ""}
                          </Link>
                        </Button>
                      )}
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                      >
                        <Link href={`/teacher/sessions/${s.id}`}>
                          <BookOpenCheck className="size-4" aria-hidden />
                          Nhật ký
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Buổi chưa điểm danh --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4" aria-hidden />
                Buổi chưa điểm danh ({needAttendance.length})
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Buổi đã diễn ra mà còn thiếu điểm danh. Buổi sắp tới không tính.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {needAttendance.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Không còn buổi nào thiếu điểm danh"
                  description="Mọi buổi đã dạy đều đã điểm danh đủ."
                />
              ) : (
                <ul className="divide-y border-t">
                  {needAttendance.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="font-mono text-xs">
                            {s.classCode}
                          </span>{" "}
                          · Buổi {s.sessionNumber}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(s.startsAt)} · Đã điểm danh {s.marked}/
                          {s.expected}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/teacher/attendance?session=${s.id}`}>
                          Điểm danh
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Bài chờ chấm --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="size-4" aria-hidden />
                Bài chờ chấm ({pendingGrading.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingGrading.length === 0 ? (
                <EmptyState
                  icon={FileCheck2}
                  title="Không có bài nào chờ chấm"
                  description="Bài nộp mới sẽ hiện ở đây."
                />
              ) : (
                <ul className="divide-y border-t">
                  {pendingGrading.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.enrollment?.student?.full_name ?? "Học viên"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {s.assignment?.title} · Nộp{" "}
                          {formatDate(s.submitted_at)}
                        </p>
                      </div>
                      {s.is_late && (
                        <StatusBadge label="Nộp muộn" tone="warning" />
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={
                            s.assignment?.id
                              ? `/teacher/assignments/${s.assignment.id}`
                              : "/teacher/assignments"
                          }
                        >
                          Chấm bài
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* --- Lớp của tôi --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Lớp của tôi ({myClasses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myClasses.length === 0 ? (
                <EmptyState
                  icon={School}
                  title="Bạn chưa được phân công lớp nào"
                  description="Quản trị viên sẽ phân công lớp cho bạn."
                />
              ) : (
                <ul className="divide-y border-t">
                  {myClasses.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/teacher/classes/${c.id}`}
                        className="hover:bg-muted/40 flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {c.code}
                            </span>
                            <StatusBadge
                              label={CLASS_STATUS_LABELS[c.status]}
                              tone={CLASS_STATUS_TONE[c.status]}
                            />
                          </div>
                          <p className="truncate text-sm">{c.name}</p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {c.openCount}/{c.capacity}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Học viên cần chú ý --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="text-warning size-4" aria-hidden />
                Học viên cần chú ý ({atRisk.length})
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Hệ thống chỉ cảnh báo — quyết định vẫn là của bạn.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {atRisk.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Không có học viên nào cần chú ý"
                  description="Chuyên cần, điểm và bài tập đều đạt ngưỡng."
                />
              ) : (
                <ul className="divide-y border-t">
                  {atRisk.map((s) => (
                    <li key={s.enrollment_id} className="px-5 py-3">
                      <p className="text-sm font-medium">{s.full_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.student_code} · {s.class_name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(s.risk_reasons ?? []).map((r) => (
                          <StatusBadge key={r} label={r} tone="warning" />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
