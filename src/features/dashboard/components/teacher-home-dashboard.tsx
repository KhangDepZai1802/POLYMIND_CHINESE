import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { vi } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Heart,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { TeacherB2CClassCards } from "@/features/b2c/components/teacher-class-cards";
import { TeacherB2CTodayClasses } from "@/features/b2c/components/teacher-today-classes";
import type {
  TeacherB2CClass,
  TeacherB2CMeetingToday,
} from "@/features/b2c/server/teacher-class-queries";
import type {
  getMyClasses,
  getPendingGrading,
  getSessionsNeedingAttendance,
  getTeacherAtRiskStudents,
  getTeacherSessionsToday,
} from "../server/teacher-queries";
import { APP_TIMEZONE, formatDate, formatTime } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

type Props = {
  fullName: string;
  now: string;
  today: Awaited<ReturnType<typeof getTeacherSessionsToday>>;
  needAttendance: Awaited<ReturnType<typeof getSessionsNeedingAttendance>>;
  pendingGrading: Awaited<ReturnType<typeof getPendingGrading>>;
  atRisk: Awaited<ReturnType<typeof getTeacherAtRiskStudents>>;
  myClasses: Awaited<ReturnType<typeof getMyClasses>>;
  b2cClasses: TeacherB2CClass[];
  b2cToday: TeacherB2CClass[];
  meetings: TeacherB2CMeetingToday[];
  todayCount: number;
  canMarkB2CAttendance?: boolean;
};
const panel =
  "min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_3px_14px_-8px_rgba(30,80,160,0.22)] dark:border-slate-800 dark:bg-slate-900";
function Panel({
  title,
  icon: Icon,
  tone,
  href,
  id,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  href?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={panel}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded text-xs font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
          >
            Xem tất cả
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-3 py-2 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
export function TeacherHomeDashboard(p: Props) {
  const kpis = [
    {
      title: "Buổi dạy hôm nay",
      value: p.todayCount,
      icon: Users,
      tone: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      hint: "Theo lịch học · Giờ Việt Nam",
      href: "#lich-day-hom-nay",
    },
    {
      title: "Buổi cần điểm danh",
      value: p.needAttendance.length,
      icon: ClipboardCheck,
      tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      hint: "Buổi B2B trong danh sách cần xử lý",
      href: "#buoi-chua-diem-danh",
    },
    {
      title: "Bài chờ chấm",
      value: p.pendingGrading.length,
      icon: FileCheck2,
      tone: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
      hint: "Bài nộp đang chờ trong danh sách",
      href: "#bai-cho-cham",
    },
    {
      title: "Học viên cần chú ý",
      value: p.atRisk.length,
      icon: AlertTriangle,
      tone: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
      hint: "Theo báo cáo lớp doanh nghiệp",
      href: "#hoc-vien-can-chu-y",
    },
  ];
  return (
    <div className="-m-4 min-h-full space-y-5 bg-gradient-to-br from-blue-50/80 via-sky-50/40 to-white p-4 text-slate-800 md:-m-6 md:p-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102752] dark:text-white">
            Xin chào, {p.fullName}{" "}
            <span className="ml-1" aria-hidden>
              👋
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Dưới đây là tổng quan công việc giảng dạy của bạn hôm nay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="hidden rounded-full bg-blue-100/40 px-6 py-2 text-center text-xs leading-relaxed text-blue-700 italic xl:block dark:bg-blue-950 dark:text-blue-300">
            Mỗi buổi dạy
            <br />
            là một cơ hội thay đổi tương lai{" "}
            <Heart className="ml-2 inline size-3" aria-hidden />
          </p>
          <p className="flex items-center gap-2 text-xs font-medium text-slate-600 first-letter:uppercase dark:text-slate-300">
            <CalendarDays className="size-4 text-blue-600" aria-hidden />
            <time
              dateTime={formatInTimeZone(p.now, APP_TIMEZONE, "yyyy-MM-dd")}
            >
              {formatInTimeZone(p.now, APP_TIMEZONE, "EEEE, dd/MM/yyyy", {
                locale: vi,
              })}
            </time>
          </p>
        </div>
      </header>
      <section
        aria-label="Tổng quan công việc hôm nay"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map(({ icon: Icon, ...k }) => (
          <Link
            href={k.href}
            key={k.title}
            className={`${panel} flex items-center gap-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600`}
          >
            <span
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${k.tone}`}
            >
              <Icon className="size-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-medium">{k.title}</h2>
              <p className="mt-1 text-2xl font-bold text-[#102752] tabular-nums dark:text-white">
                {k.value}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {k.hint}
              </p>
            </div>
          </Link>
        ))}
      </section>
      <TeacherB2CClassCards classes={p.b2cClasses} compact />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Panel
            id="lich-day-hom-nay"
            title={`Lịch dạy hôm nay (${p.todayCount})`}
            icon={CalendarDays}
            tone="text-blue-600"
            href="/teacher/classes"
          >
            {!p.today.length && !p.b2cToday.length && !p.meetings.length && (
              <Empty
                icon={CalendarDays}
                title="Hôm nay bạn không có buổi dạy"
                description="Xem toàn bộ lớp được phân công tại Lớp của tôi."
              />
            )}
            <div className="space-y-3">
              {p.today.map((s) => (
                <article
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/30 p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <p className="text-sm font-semibold text-blue-950 tabular-nums dark:text-blue-100">
                    {formatTime(s.startsAt)}
                    <br />– {formatTime(s.endsAt)}
                  </p>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold break-words">{s.className}</h3>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      {s.classCode} · Buổi {s.sessionNumber}
                    </p>
                    {s.topic && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {s.topic}
                      </p>
                    )}
                    <p className="mt-1 text-xs">
                      Đã điểm danh {s.marked}/{s.expected}
                    </p>
                  </div>
                  {!s.isFullyMarked && (
                    <Button asChild size="sm">
                      <Link href={`/teacher/attendance?session=${s.id}`}>
                        Điểm danh
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/teacher/sessions/${s.id}`}>Nhật ký</Link>
                  </Button>
                </article>
              ))}
            </div>
            <TeacherB2CTodayClasses
              classes={p.b2cToday}
              meetings={p.meetings}
              canMarkAttendance={p.canMarkB2CAttendance}
            />
          </Panel>
          <Panel
            id="buoi-chua-diem-danh"
            title={`Buổi chưa điểm danh (${p.needAttendance.length})`}
            icon={ClipboardCheck}
            tone="text-violet-600"
          >
            {!p.needAttendance.length ? (
              <Empty
                icon={ClipboardCheck}
                title="Không còn buổi nào thiếu điểm danh"
                description="Chưa có buổi B2B cần bổ sung điểm danh."
              />
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {p.needAttendance.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {s.classCode} · Buổi {s.sessionNumber}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
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
          </Panel>
          <Panel
            id="bai-cho-cham"
            title={`Bài chờ chấm (${p.pendingGrading.length})`}
            icon={FileCheck2}
            tone="text-violet-600"
          >
            {!p.pendingGrading.length ? (
              <Empty
                icon={FileCheck2}
                title="Không có bài nào chờ chấm"
                description="Bài nộp mới sẽ hiển thị tại đây."
              />
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {p.pendingGrading.map((s) => (
                  <li
                    key={`${s.kind}-${s.id}`}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {s.enrollment?.student?.full_name ?? "Học viên"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.delivery?.title} · Nộp {formatDate(s.submitted_at)}
                      </p>
                    </div>
                    {s.is_late && (
                      <StatusBadge label="Nộp muộn" tone="warning" />
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={
                          s.delivery?.id
                            ? `/teacher/${s.kind === "exercise" ? "exercises" : "exams"}/${s.delivery.id}`
                            : `/teacher/${s.kind === "exercise" ? "exercises" : "exams"}`
                        }
                      >
                        Chấm bài
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="min-w-0 space-y-4">
          <Panel
            title={`Lớp doanh nghiệp của tôi (${p.myClasses.length})`}
            icon={School}
            tone="text-blue-600"
            href="/teacher/classes"
          >
            {!p.myClasses.length ? (
              <Empty
                icon={Users}
                title="Chưa có lớp doanh nghiệp được phân công"
                description="Các lớp trung tâm của bạn hiển thị ở phía trên."
              />
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {p.myClasses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-lg py-3 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold break-words">
                          {c.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {c.code} · {c.openCount}/{c.capacity} học viên
                        </p>
                      </div>
                      <StatusBadge
                        label={CLASS_STATUS_LABELS[c.status]}
                        tone={CLASS_STATUS_TONE[c.status]}
                      />
                      <ArrowRight
                        className="size-4 text-blue-600"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            id="hoc-vien-can-chu-y"
            title={`Học viên cần chú ý (${p.atRisk.length})`}
            icon={AlertTriangle}
            tone="text-orange-600"
            href="/teacher/progress"
          >
            {!p.atRisk.length ? (
              <Empty
                icon={Users}
                title="Không có học viên nào cần chú ý"
                description="Chưa có cảnh báo từ báo cáo lớp doanh nghiệp."
              />
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {p.atRisk.map((s) => (
                  <li key={s.enrollment_id} className="space-y-1 py-3">
                    <p className="text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.student_code} · {s.class_name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(s.risk_reasons ?? []).map((r) => (
                        <StatusBadge key={r} label={r} tone="warning" />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
