import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  School,
  Target,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStudentAssessmentOverview } from "@/features/assessment-results/server/overview";
import { SessionCalendar } from "@/features/schedules/components/schedule-manager";
import { MaterialList } from "@/features/student/components/material-list";
import {
  getMyAttendanceSummary,
  getMyClassOverview,
  getMyEnrollment,
  getMyMaterials,
  getMyProgress,
  getMySchedule,
} from "@/features/student/server/queries";
import { requireRole } from "@/lib/auth/session";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatPercent,
  formatScore,
  weekdayLabel,
} from "@/lib/dates";
import { formatAttendanceScore } from "@/lib/domain/attendance";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_TONE,
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lớp của tôi" };

export default async function StudentClassPage() {
  await requireRole("student");
  const enrollment = await getMyEnrollment();

  if (!enrollment?.class) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Lớp của tôi"
          description="Thông tin lớp, lịch học, bài tập và tiến độ của bạn."
        />
        <Card className="border-student-sky-border bg-student-sky-surface overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Khi trung tâm xếp lớp, toàn bộ thông tin lớp sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const classId = enrollment.class.id;
  const courseId = enrollment.class.course?.id;
  const [overview, sessions, materials, attendance, progress, assessments] =
    await Promise.all([
      getMyClassOverview(classId),
      getMySchedule(classId),
      courseId ? getMyMaterials(courseId) : Promise.resolve([]),
      getMyAttendanceSummary(enrollment.id),
      getMyProgress(enrollment.id),
      getStudentAssessmentOverview(),
    ]);

  const schedules = [...(overview?.class_schedules ?? [])].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  );
  // `class_teachers.class_id` là UNIQUE (mỗi lớp đúng một giáo viên phụ
  // trách), vì vậy Supabase sinh quan hệ one-to-one thay vì mảng.
  const teachers = overview?.class_teachers ? [overview.class_teachers] : [];
  const exercises = assessments.exercises;
  const exams = assessments.exams;
  const markedSessions = sessions.filter((session) => session.myAttendance);
  const percent = clampPercent(progress?.progress_percent ?? null);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Lớp của tôi"
        description={`${enrollment.class.code} · ${enrollment.class.name}`}
      />

      {overview && (
        <Card className="border-student-sky-border bg-student-sky-surface mb-5 gap-0 overflow-hidden py-0 shadow-none">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
              <School className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-student-sky-ink text-sm font-semibold">
                {overview.course?.code ?? enrollment.class.code}
              </p>
              <p className="mt-1 text-lg font-bold break-words">
                {overview.course?.title ?? enrollment.class.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
              <StatusBadge
                label={CLASS_STATUS_LABELS[overview.status]}
                tone={CLASS_STATUS_TONE[overview.status]}
              />
              <span className="text-text-secondary text-sm">
                {DELIVERY_MODE_LABELS[overview.delivery_mode]} ·{" "}
                {sessions.length}/{overview.planned_session_count ?? "—"} buổi
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        {/*
          `tabIndex={0}` + vòng focus: ở 360px bảy tab không đủ chỗ nên dải này
          cuộn ngang, mà vùng cuộn không focus được thì người dùng bàn phím
          không tới được ba tab cuối (axe `scrollable-region-focusable`).
          Ba dải tab học viên còn lại (`/student/exercises`, `/student/review`,
          `/student/results`) đã có từ trước — chỉ màn này bị sót (`P15-T9`).
        */}
        <nav
          aria-label="Nội dung lớp học"
          tabIndex={0}
          className="border-student-sky-border bg-student-sky-surface focus-visible:ring-ring overflow-x-auto rounded-xl border p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <TabsList className="min-w-max bg-transparent p-0">
            <StudentTab value="overview" icon={School} label="Tổng quan" />
            <StudentTab
              value="schedule"
              icon={CalendarDays}
              label="Lịch/Buổi"
            />
            <StudentTab value="exercises" icon={FileText} label="Bài tập" />
            <StudentTab value="exams" icon={GraduationCap} label="Kiểm tra" />
            <StudentTab value="progress" icon={Target} label="Tiến độ" />
            <StudentTab
              value="attendance"
              icon={ClipboardList}
              label="Chuyên cần"
            />
            <StudentTab value="materials" icon={BookOpen} label="Tài liệu" />
          </TabsList>
        </nav>

        <TabsContent value="overview" className="mt-4">
          {!overview ? (
            <EmptyPanel
              icon={School}
              title="Chưa có thông tin lớp"
              description="Thông tin lớp sẽ hiện khi trung tâm hoàn tất xếp lớp."
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <StudentSectionCard
                icon={School}
                title="Thông tin lớp"
                tone="sky"
              >
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <Field label="Khóa học" value={overview.course?.title} />
                  <Field label="Mã khóa" value={overview.course?.code} />
                  <Field
                    label="Khai giảng"
                    value={formatDate(overview.start_date)}
                  />
                  <Field
                    label="Dự kiến kết thúc"
                    value={formatDate(overview.expected_end_date)}
                  />
                  <Field
                    label="Thời lượng"
                    value={
                      overview.session_duration_minutes
                        ? `${overview.session_duration_minutes} phút/buổi`
                        : null
                    }
                  />
                  <Field label="Đối tượng" value={overview.target_audience} />
                </CardContent>
              </StudentSectionCard>

              <StudentSectionCard
                icon={MapPin}
                title="Địa điểm học"
                tone="cyan"
              >
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Hình thức"
                    value={DELIVERY_MODE_LABELS[overview.delivery_mode]}
                  />
                  <Field label="Tên địa điểm" value={overview.location_name} />
                  <Field label="Địa chỉ" value={overview.address} />
                  <Field label="Ghi chú" value={overview.location_note} />
                  {overview.meeting_url && (
                    <div className="sm:col-span-2">
                      <p className="text-text-secondary text-sm font-medium">
                        Phòng học trực tuyến
                      </p>
                      <a
                        href={overview.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary focus-visible:ring-ring mt-1 inline-flex max-w-full items-start gap-2 rounded-md text-sm break-all hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span>{overview.meeting_url}</span>
                        <ExternalLink
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                      </a>
                    </div>
                  )}
                </CardContent>
              </StudentSectionCard>

              <StudentSectionCard
                icon={Users}
                title="Giáo viên phụ trách"
                tone="amber"
                className="xl:col-span-2"
              >
                <CardContent className="p-0">
                  {teachers.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="Chưa phân công giáo viên"
                      description="Giáo viên phụ trách sẽ hiện ở đây khi được phân công."
                    />
                  ) : (
                    <ul className="divide-y">
                      {teachers.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold break-words">
                              {assignment.teacher?.profile?.full_name ??
                                "Giáo viên"}
                            </p>
                            <p className="text-text-secondary mt-1 text-sm">
                              {assignment.teacher?.teacher_code ?? "—"}
                              {assignment.teacher?.specialization
                                ? ` · ${assignment.teacher.specialization}`
                                : ""}
                            </p>
                          </div>
                          <StatusBadge
                            label="Giáo viên phụ trách"
                            tone="info"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </StudentSectionCard>
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 space-y-5">
          <StudentSectionCard
            icon={CalendarDays}
            title="Lịch học lặp"
            tone="sky"
          >
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Lớp chưa có lịch lặp"
                  description="Đây có thể là lớp học theo lịch linh hoạt. Các buổi học vẫn hiện bên dưới."
                />
              ) : (
                <ul className="divide-y">
                  {schedules.map((schedule) => (
                    <li
                      key={schedule.id}
                      className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[6rem_auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-6"
                    >
                      <span className="font-semibold">
                        {weekdayLabel(schedule.weekday)}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <Clock3
                          className="text-student-sky-ink size-4"
                          aria-hidden
                        />
                        {formatClock(schedule.start_time)}–
                        {formatClock(schedule.end_time)}
                      </span>
                      <span className="text-text-secondary sm:text-right">
                        {formatDate(schedule.effective_from)} →{" "}
                        {formatDate(schedule.effective_to)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </StudentSectionCard>

          <StudentSectionCard
            icon={CalendarDays}
            title={`Danh sách buổi học (${sessions.length})`}
            tone="cyan"
          >
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Lớp chưa có buổi học nào"
                  description="Khi trung tâm xếp lịch, các buổi học sẽ hiện ở đây."
                />
              ) : (
                <SessionCalendar mode="student" sessions={sessions} />
              )}
            </CardContent>
          </StudentSectionCard>
        </TabsContent>

        <TabsContent value="exercises" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button asChild size="sm">
              <Link href="/student/exercises">Xem tất cả bài tập</Link>
            </Button>
          </div>
          {exercises.length === 0 ? (
            <EmptyPanel
              icon={FileText}
              title="Chưa có bài tập"
              description="Bài tập giáo viên giao cho lớp sẽ hiện ở đây."
              tone="amber"
            />
          ) : (
            <StudentSectionCard icon={FileText} title="Bài tập" tone="amber">
              <CardContent className="p-0">
                <ul className="divide-y">
                  {exercises.map((exercise) => {
                    const submitted = exercise.attempts.some(
                      (attempt) => attempt.submitted_at,
                    );
                    const published = exercise.attempts.find(
                      (attempt) => attempt.results_published_at,
                    );
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
                            Hạn {formatDateTime(exercise.due_at)}
                            {published
                              ? ` · Điểm ${formatScore(published.final_score)}/${exercise.max_score}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge
                            label={
                              published
                                ? "Đã chấm"
                                : submitted
                                  ? "Đã nộp"
                                  : "Cần làm"
                            }
                            tone={
                              published
                                ? "success"
                                : submitted
                                  ? "info"
                                  : "warning"
                            }
                          />
                          <Button asChild size="sm" variant="outline">
                            <Link href="/student/exercises">
                              {submitted ? "Xem" : "Làm bài"}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </StudentSectionCard>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button asChild size="sm">
              <Link href="/student/exams">Xem tất cả bài kiểm tra</Link>
            </Button>
          </div>
          {exams.length === 0 ? (
            <EmptyPanel
              icon={GraduationCap}
              title="Chưa có bài kiểm tra"
              description="Kỳ kiểm tra / thi của lớp sẽ hiện ở đây."
              tone="coral"
            />
          ) : (
            <StudentSectionCard
              icon={GraduationCap}
              title="Kiểm tra"
              tone="coral"
            >
              <CardContent className="p-0">
                <ul className="divide-y">
                  {exams.map((exam) => {
                    const submitted = exam.attempts.some(
                      (attempt) => attempt.submitted_at,
                    );
                    return (
                      <li
                        key={exam.id}
                        className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold break-words">
                            {exam.title}
                          </p>
                          <p className="text-text-secondary mt-1 text-sm leading-6">
                            {formatDateTime(exam.opens_at)} →{" "}
                            {formatDateTime(exam.closes_at)}
                            {exam.results_published_at
                              ? ` · Điểm ${formatScore(exam.attempts[0]?.final_score_100)}/100`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge
                            label={
                              exam.results_published_at
                                ? "Có kết quả"
                                : submitted
                                  ? "Đã nộp"
                                  : "Chưa làm"
                            }
                            tone={
                              exam.results_published_at
                                ? "success"
                                : submitted
                                  ? "info"
                                  : "warning"
                            }
                          />
                          <Button asChild size="sm" variant="outline">
                            <Link href="/student/exams">
                              {submitted ? "Xem" : "Vào thi"}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </StudentSectionCard>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          {!progress ? (
            <EmptyPanel
              icon={Target}
              title="Chưa có dữ liệu tiến độ"
              description="Tiến độ được hệ thống tính từ bài học, chuyên cần, bài tập và kiểm tra."
              tone="cyan"
            />
          ) : (
            <StudentSectionCard
              icon={Target}
              title="Tiến độ của bạn"
              tone="cyan"
            >
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge
                    label={
                      progress.is_completion_ready
                        ? "Đủ điều kiện hoàn thành"
                        : "Chưa đủ điều kiện"
                    }
                    tone={progress.is_completion_ready ? "success" : "warning"}
                  />
                  <span className="text-2xl font-bold tabular-nums">
                    {formatPercent(progress.progress_percent)}
                  </span>
                </div>
                <div
                  className="bg-muted h-3 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label="Tiến độ của bạn"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ProgressStat
                    label="Chuyên cần"
                    value={formatPercent(progress.attendance_rate)}
                  />
                  <ProgressStat
                    label="Bài học"
                    value={`${progress.completed_lessons ?? 0}/${progress.total_lessons ?? 0}`}
                  />
                  <ProgressStat
                    label="Bài tập"
                    value={`${progress.submitted_exercises ?? 0}/${progress.total_exercises ?? 0}`}
                  />
                  <ProgressStat
                    label="Điểm TB"
                    value={formatScore(progress.avg_score)}
                  />
                </div>
              </CardContent>
            </StudentSectionCard>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <AttendanceStat
              label="Điểm chuyên cần"
              value={`${formatAttendanceScore(attendance?.absent_count)}/10`}
              tone="sky"
            />
            <AttendanceStat
              label="Tỉ lệ chuyên cần"
              value={formatPercent(attendance?.attendance_rate)}
              tone="cyan"
            />
            <AttendanceStat
              label="Có mặt"
              value={attendance?.present_count ?? 0}
              tone="cyan"
            />
            <AttendanceStat
              label="Đi muộn"
              value={attendance?.late_count ?? 0}
              tone="amber"
            />
            <AttendanceStat
              label="Vắng"
              value={attendance?.absent_count ?? 0}
              tone="coral"
            />
            <AttendanceStat
              label="Có phép"
              value={attendance?.excused_count ?? 0}
              tone="sky"
            />
          </div>

          <StudentSectionCard
            icon={ClipboardList}
            title="Chuyên cần"
            tone="sky"
            className="mt-4"
          >
            <CardContent className="p-0">
              {markedSessions.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Chưa có buổi nào được điểm danh"
                  description="Giáo viên điểm danh xong thì kết quả sẽ hiện ở đây."
                />
              ) : (
                <ul className="divide-y">
                  {markedSessions.map((session) => (
                    <li
                      key={session.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">
                          Buổi {session.session_number} ·{" "}
                          {formatDateTime(session.starts_at)}
                        </p>
                        {session.myAttendance?.note && (
                          <p className="text-text-secondary mt-1 text-sm leading-6">
                            {session.myAttendance.note}
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        label={
                          ATTENDANCE_STATUS_LABELS[session.myAttendance!.status]
                        }
                        tone={
                          ATTENDANCE_STATUS_TONE[session.myAttendance!.status]
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </StudentSectionCard>
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <StudentSectionCard icon={BookOpen} title="Tài liệu" tone="amber">
            <CardContent className="p-0">
              {materials.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Chưa có tài liệu"
                  description="Chỉ tài liệu giáo viên chia sẻ cho học viên mới hiện ở đây."
                />
              ) : (
                <MaterialList materials={materials} />
              )}
            </CardContent>
          </StudentSectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudentTab({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </TabsTrigger>
  );
}

type StudentTone = "sky" | "cyan" | "amber" | "coral";

const STUDENT_TONES: Record<
  StudentTone,
  { border: string; header: string; icon: string }
> = {
  sky: {
    border: "border-student-sky-border",
    header: "bg-student-sky-surface",
    icon: "bg-student-sky-ink text-primary-foreground",
  },
  cyan: {
    border: "border-student-cyan-border",
    header: "bg-student-cyan-surface",
    icon: "bg-student-cyan-ink text-primary-foreground",
  },
  amber: {
    border: "border-student-amber-border",
    header: "bg-student-amber-surface",
    icon: "bg-student-amber-ink text-primary-foreground",
  },
  coral: {
    border: "border-student-coral-border",
    header: "bg-student-coral-surface",
    icon: "bg-student-coral-ink text-primary-foreground",
  },
};

function StudentSectionCard({
  icon: Icon,
  title,
  tone,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone: StudentTone;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = STUDENT_TONES[tone];

  return (
    <Card
      className={`${toneClass.border} gap-0 overflow-hidden py-0 shadow-sm ${className}`}
    >
      <CardHeader className={`${toneClass.header} border-b px-5 py-4 sm:px-6`}>
        <CardTitle asChild>
          <h2 className="flex items-center gap-3 text-base">
            <span
              className={`${toneClass.icon} flex size-9 items-center justify-center rounded-xl`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            {title}
          </h2>
        </CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-text-secondary text-sm font-medium">{label}</p>
      <p className="mt-1 font-semibold break-words whitespace-pre-line">
        {value ?? "—"}
      </p>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-student-cyan-border bg-student-cyan-surface rounded-xl border p-4">
      <p className="text-text-secondary text-sm font-medium">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function AttendanceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: StudentTone;
}) {
  const toneClass = STUDENT_TONES[tone];

  return (
    <Card
      className={`${toneClass.border} ${toneClass.header} gap-2 py-4 shadow-none`}
    >
      <CardContent className="px-4">
        <p className="text-text-secondary text-sm font-medium">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
  tone = "sky",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: StudentTone;
}) {
  const toneClass = STUDENT_TONES[tone];

  return (
    <Card className={`${toneClass.border} ${toneClass.header}`}>
      <CardContent className="p-0">
        <EmptyState icon={icon} title={title} description={description} />
      </CardContent>
    </Card>
  );
}

function clampPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
