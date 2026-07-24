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

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentStatCard } from "@/components/shared/student-stat-card";
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
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title={`Xin chào, ${user.fullName}`}
          description="Buổi học kế tiếp, bài sắp đến hạn và tiến độ của bạn."
        />
        <Card className="border-student-sky-border bg-student-sky-surface relative overflow-hidden shadow-sm">
          <div
            className="bg-brand-orange absolute -top-5 -right-5 size-20 rounded-full"
            aria-hidden
          />
          <div
            className="border-student-sky-border absolute -bottom-10 -left-10 size-28 rounded-full border-[16px]"
            aria-hidden
          />
          <CardContent className="relative p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Khi trung tâm xếp lớp cho bạn, lịch học và bài tập sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </div>
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
  const outstandingBalance = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={`${enrollment.class.code} — ${enrollment.class.name}`}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="border-primary-700 bg-primary text-primary-foreground relative min-h-72 overflow-hidden py-0 shadow-md lg:col-span-7">
          <div
            className="border-primary-500 absolute -top-14 -right-12 size-48 rounded-full border-[28px]"
            aria-hidden
          />
          <div
            className="bg-brand-orange absolute top-8 right-8 size-5 rounded-full"
            aria-hidden
          />
          <div
            className="bg-brand-red absolute right-20 bottom-10 size-3 rounded-full"
            aria-hidden
          />
          <span
            className="font-hanzi text-primary-300 absolute right-8 bottom-2 text-8xl font-bold"
            aria-hidden
          >
            学
          </span>

          <CardContent className="relative flex h-full min-h-72 flex-col justify-between gap-8 p-6 sm:p-8">
            <div>
              <CardTitle asChild>
                <h2 className="bg-primary-700 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm">
                  <CalendarDays className="size-4" aria-hidden />
                  Buổi học kế tiếp
                </h2>
              </CardTitle>
              <p className="mt-6 max-w-xl text-2xl leading-tight font-bold text-balance sm:text-3xl">
                {nextSession
                  ? formatDateTime(nextSession.starts_at)
                  : "Chưa có buổi nào sắp tới"}
              </p>
              <p className="text-primary-100 mt-3 max-w-xl text-sm leading-6 sm:text-base">
                {nextSession
                  ? `Buổi ${nextSession.session_number}${nextSession.topic ? ` · ${nextSession.topic}` : ""}`
                  : "Lịch học mới của lớp sẽ được cập nhật tại đây."}
              </p>
            </div>

            <div className="border-primary-500 bg-primary-700 flex w-fit items-center gap-3 rounded-xl border px-4 py-3">
              <School className="size-5" aria-hidden />
              <span className="text-sm font-medium">
                {enrollment.class.code} — {enrollment.class.name}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2">
          <StudentStatCard
            icon={FileText}
            label="Bài chưa nộp"
            value={pendingExercises.length}
            hint={
              pendingExercises.length > 0
                ? "Xem hạn nộp bên dưới"
                : "Bạn đã nộp hết bài được giao"
            }
            tone="amber"
          />
          <StudentStatCard
            icon={ClipboardList}
            label="Điểm chuyên cần"
            value={`${formatAttendanceScore(attendance?.absent_count)}/10`}
            hint={`${attendance?.present_count ?? 0} có mặt · ${attendance?.absent_count ?? 0} vắng`}
            tone="cyan"
          />
          <StudentStatCard
            icon={Wallet}
            label="Còn phải đóng"
            value={formatCurrency(outstandingBalance)}
            hint={
              overdueInvoices.length > 0
                ? `${overdueInvoices.length} hóa đơn quá hạn`
                : "Không có khoản quá hạn"
            }
            tone="coral"
            className="sm:col-span-2"
          />
        </div>
      </div>

      {overdueInvoices.length > 0 && (
        <Card className="border-student-coral-border bg-student-coral-surface mt-5 py-0 shadow-none">
          <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm sm:px-6">
            <span className="bg-student-coral-ink text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 leading-6">
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
        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className="border-b px-5 py-5 sm:px-6">
            <CardTitle asChild>
              <h2 className="flex items-center gap-2 text-base">
                <span className="bg-student-amber-surface text-student-amber-ink flex size-9 items-center justify-center rounded-lg">
                  <FileText className="size-4" aria-hidden />
                </span>
                Bài tập cần nộp ({pendingExercises.length})
              </h2>
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
                  const overdue = new Date(exercise.due_at) < new Date();

                  return (
                    <li
                      key={exercise.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold break-words">
                          {exercise.title}
                        </p>
                        <p className="text-text-secondary mt-1 text-sm leading-6">
                          Hạn {formatDateTime(exercise.due_at)} · Tối đa{" "}
                          {formatScore(exercise.max_score)} điểm
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {overdue && (
                          <StatusBadge label="Quá hạn" tone="warning" />
                        )}
                        <Button asChild size="sm">
                          <Link href="/student/exercises">Làm bài</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className="border-b px-5 py-5 sm:px-6">
            <CardTitle asChild>
              <h2 className="flex items-center gap-2 text-base">
                <span className="bg-student-sky-surface text-student-sky-ink flex size-9 items-center justify-center rounded-lg">
                  <CalendarDays className="size-4" aria-hidden />
                </span>
                Buổi học sắp tới
              </h2>
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
                  <li
                    key={session.id}
                    className="flex items-start gap-3 px-5 py-4 sm:px-6"
                  >
                    <span className="bg-student-sky-surface text-student-sky-ink flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                      {session.session_number}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        Buổi {session.session_number} ·{" "}
                        {formatDateTime(session.starts_at)}
                      </p>
                      <p className="text-text-secondary mt-1 text-sm leading-6">
                        {session.topic ?? "Chưa có chủ đề"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0 shadow-sm xl:col-span-2">
          <CardHeader className="border-b px-5 py-5 sm:px-6">
            <CardTitle asChild>
              <h2 className="flex items-center gap-2 text-base">
                <span className="bg-student-cyan-surface text-student-cyan-ink flex size-9 items-center justify-center rounded-lg">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                Kết quả mới công bố
              </h2>
            </CardTitle>
            <p className="text-text-secondary text-sm">
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
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {result.title}
                      </p>
                      <p className="text-text-secondary mt-1 text-sm leading-6">
                        {result.kind} · Công bố {formatDate(result.publishedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="bg-primary-50 text-primary-700 rounded-full px-3 py-2 text-sm font-bold">
                        {formatScore(result.score)}/
                        {formatScore(result.maxScore)}
                      </span>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={result.href}>Xem</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardContent className="border-t px-5 py-4 sm:px-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/student/results">Xem tất cả kết quả</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
