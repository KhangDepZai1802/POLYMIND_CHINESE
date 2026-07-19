import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  School,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDashboard } from "@/features/dashboard/server/student-queries";
import { requireRole } from "@/lib/auth/session";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatScore,
} from "@/lib/dates";
import { formatAttendanceScore } from "@/lib/domain/attendance";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function StudentDashboardPage() {
  const [user, data] = await Promise.all([
    requireRole("student"),
    getStudentDashboard(),
  ]);

  if (!data.enrollment?.class) {
    return (
      <>
        <PageHeader
          title={`Xin chào, ${user.fullName}`}
          description="Buổi học kế tiếp, bài sắp đến hạn và tiến độ của bạn."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Khi trung tâm xếp lớp cho bạn, lịch học và bài tập sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const {
    enrollment,
    sessions,
    pendingExercises,
    attendance,
    results,
    invoices,
  } = data;
  const nextSession = sessions[0];
  const overdueInvoices = invoices.filter((invoice) => invoice.is_overdue);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={`${enrollment.class.code} — ${enrollment.class.name}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={CalendarDays}
          label="Buổi học kế tiếp"
          value={nextSession ? formatDateTime(nextSession.starts_at) : "—"}
          hint={
            nextSession
              ? `Buổi ${nextSession.session_number}${nextSession.topic ? ` · ${nextSession.topic}` : ""}`
              : "Chưa có buổi nào sắp tới"
          }
        />
        <Stat
          icon={FileText}
          label="Bài chưa nộp"
          value={pendingExercises.length}
          hint={
            pendingExercises.length > 0
              ? "Xem hạn nộp bên dưới"
              : "Bạn đã nộp hết bài được giao"
          }
        />
        <Stat
          icon={ClipboardList}
          label="Điểm chuyên cần"
          value={`${formatAttendanceScore(attendance?.absent_count)}/10`}
          hint={`${attendance?.present_count ?? 0} có mặt · ${attendance?.absent_count ?? 0} vắng`}
        />
        <Stat
          icon={Wallet}
          label="Còn phải đóng"
          value={formatCurrency(
            invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0),
          )}
          hint={
            overdueInvoices.length > 0
              ? `${overdueInvoices.length} hóa đơn quá hạn`
              : "Không có khoản quá hạn"
          }
        />
      </div>

      {overdueInvoices.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 mt-5">
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <AlertTriangle className="text-warning size-4" aria-hidden />
            <span className="flex-1">
              Bạn có <strong>{overdueInvoices.length}</strong> hóa đơn quá hạn —
              tổng{" "}
              {formatCurrency(
                overdueInvoices.reduce(
                  (sum, invoice) => sum + Number(invoice.balance),
                  0,
                ),
              )}
              . Vui lòng liên hệ trung tâm.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {/* --- Bài tập cần nộp --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Bài tập cần nộp ({pendingExercises.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingExercises.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Không có bài nào chờ nộp"
                description="Bài tập mới được giao sẽ hiện ở đây kèm hạn nộp."
              />
            ) : (
              <ul className="divide-y">
                {pendingExercises.map((exercise) => {
                  const overdue =
                    new Date(exercise.due_at) < new Date();

                  return (
                    <li
                      key={exercise.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {exercise.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Hạn {formatDateTime(exercise.due_at)} · Tối đa{" "}
                          {formatScore(exercise.max_score)} điểm
                        </p>
                      </div>
                      {overdue && (
                        <StatusBadge label="Quá hạn" tone="warning" />
                      )}
                      <Button asChild size="sm">
                        <Link href="/student/exercises">
                          Làm bài
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* --- Lịch học sắp tới --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" aria-hidden />
              Buổi học sắp tới
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Chưa có buổi nào sắp tới"
                description="Lịch học của lớp sẽ hiện ở đây."
              />
            ) : (
              <ul className="divide-y">
                {sessions.map((session) => (
                  <li key={session.id} className="px-5 py-3">
                    <p className="text-sm font-medium">
                      Buổi {session.session_number} ·{" "}
                      {formatDateTime(session.starts_at)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {session.topic ?? "Chưa có chủ đề"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* --- Kết quả mới --- */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4" aria-hidden />
              Kết quả mới công bố
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Chỉ hiện kết quả giáo viên đã công bố.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {results.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Chưa có kết quả nào"
                description="Điểm bài kiểm tra sẽ hiện sau khi giáo viên công bố."
              />
            ) : (
              <ul className="divide-y">
                {results.map((result) => (
                  <li
                    key={result.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {result.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {result.kind} · Công bố {formatDate(result.publishedAt)}
                      </p>
                    </div>
                    <span className="font-semibold">
                      {formatScore(result.score)}/{formatScore(result.maxScore)}
                    </span>
                    <Button asChild size="sm" variant="ghost"><Link href={result.href}>Xem</Link></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/student/results">Xem tất cả kết quả</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="mt-0.5 text-lg font-semibold">{value}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
