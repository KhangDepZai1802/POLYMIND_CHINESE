import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  MapPin,
  School,
  Target,
  Users,
} from "lucide-react";

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
      <>
        <PageHeader
          title="Lớp của tôi"
          description="Thông tin lớp, lịch học, bài tập và tiến độ của bạn."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Khi trung tâm xếp lớp, toàn bộ thông tin lớp sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </>
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
    <>
      <PageHeader
        title="Lớp của tôi"
        description={`${enrollment.class.code} · ${enrollment.class.name}`}
      />

      {overview && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <StatusBadge
            label={CLASS_STATUS_LABELS[overview.status]}
            tone={CLASS_STATUS_TONE[overview.status]}
          />
          <span className="text-muted-foreground text-sm">
            {DELIVERY_MODE_LABELS[overview.delivery_mode]} · {sessions.length}/
            {overview.planned_session_count ?? "—"} buổi
          </span>
        </div>
      )}

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="schedule">Lịch/Buổi</TabsTrigger>
            <TabsTrigger value="exercises">Bài tập</TabsTrigger>
            <TabsTrigger value="exams">Kiểm tra</TabsTrigger>
            <TabsTrigger value="progress">Tiến độ</TabsTrigger>
            <TabsTrigger value="attendance">Chuyên cần</TabsTrigger>
            <TabsTrigger value="materials">Tài liệu</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Tổng quan --- */}
        <TabsContent value="overview" className="mt-4">
          {!overview ? (
            <EmptyPanel
              icon={School}
              title="Chưa có thông tin lớp"
              description="Thông tin lớp sẽ hiện khi trung tâm hoàn tất xếp lớp."
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <School className="size-4" aria-hidden />
                    Thông tin lớp
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="size-4" aria-hidden />
                    Địa điểm học
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Hình thức"
                    value={DELIVERY_MODE_LABELS[overview.delivery_mode]}
                  />
                  <Field label="Tên địa điểm" value={overview.location_name} />
                  <Field label="Địa chỉ" value={overview.address} />
                  <Field label="Ghi chú" value={overview.location_note} />
                  {overview.meeting_url && (
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground text-xs">
                        Phòng học trực tuyến
                      </p>
                      <a
                        href={overview.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary mt-0.5 block truncate text-sm hover:underline"
                      >
                        {overview.meeting_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4" aria-hidden />
                    Giáo viên phụ trách
                  </CardTitle>
                </CardHeader>
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
                          className="flex items-center justify-between gap-3 px-5 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {assignment.teacher?.profile?.full_name ??
                                "Giáo viên"}
                            </p>
                            <p className="text-muted-foreground text-xs">
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
              </Card>
            </div>
          )}
        </TabsContent>

        {/* --- Lịch/Buổi --- */}
        <TabsContent value="schedule" className="mt-4 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden />
                Lịch học lặp
              </CardTitle>
            </CardHeader>
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
                      className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                    >
                      <span className="w-24 font-medium">
                        {weekdayLabel(schedule.weekday)}
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock3
                          className="text-muted-foreground size-4"
                          aria-hidden
                        />
                        {formatClock(schedule.start_time)}–
                        {formatClock(schedule.end_time)}
                      </span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {formatDate(schedule.effective_from)} →{" "}
                        {formatDate(schedule.effective_to)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Danh sách buổi học ({sessions.length})
              </CardTitle>
            </CardHeader>
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
          </Card>
        </TabsContent>

        {/* --- Bài tập --- */}
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
            />
          ) : (
            <Card>
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
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {exercise.title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Hạn {formatDateTime(exercise.due_at)}
                            {published
                              ? ` · Điểm ${formatScore(published.final_score)}/${exercise.max_score}`
                              : ""}
                          </p>
                        </div>
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
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Kiểm tra --- */}
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
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {exams.map((exam) => {
                    const submitted = exam.attempts.some(
                      (attempt) => attempt.submitted_at,
                    );
                    return (
                      <li
                        key={exam.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {exam.title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatDateTime(exam.opens_at)} →{" "}
                            {formatDateTime(exam.closes_at)}
                            {exam.results_published_at
                              ? ` · Điểm ${formatScore(exam.attempts[0]?.final_score_100)}/100`
                              : ""}
                          </p>
                        </div>
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
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Tiến độ --- */}
        <TabsContent value="progress" className="mt-4">
          {!progress ? (
            <EmptyPanel
              icon={Target}
              title="Chưa có dữ liệu tiến độ"
              description="Tiến độ được hệ thống tính từ bài học, chuyên cần, bài tập và kiểm tra."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tiến độ của bạn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge
                    label={
                      progress.is_completion_ready
                        ? "Đủ điều kiện hoàn thành"
                        : "Chưa đủ điều kiện"
                    }
                    tone={progress.is_completion_ready ? "success" : "warning"}
                  />
                  <span className="text-lg font-semibold tabular-nums">
                    {formatPercent(progress.progress_percent)}
                  </span>
                </div>
                <div
                  className="bg-muted h-2 overflow-hidden rounded-full"
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
                <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-4">
                  <span>
                    Chuyên cần: {formatPercent(progress.attendance_rate)}
                  </span>
                  <span>
                    Bài học: {progress.completed_lessons ?? 0}/
                    {progress.total_lessons ?? 0}
                  </span>
                  <span>
                    Bài tập: {progress.submitted_exercises ?? 0}/
                    {progress.total_exercises ?? 0}
                  </span>
                  <span>Điểm TB: {formatScore(progress.avg_score)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Chuyên cần --- */}
        <TabsContent value="attendance" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <AttendanceStat
              label="Điểm chuyên cần"
              value={`${formatAttendanceScore(attendance?.absent_count)}/10`}
            />
            <AttendanceStat
              label="Tỉ lệ chuyên cần"
              value={formatPercent(attendance?.attendance_rate)}
            />
            <AttendanceStat
              label="Có mặt"
              value={attendance?.present_count ?? 0}
            />
            <AttendanceStat
              label="Đi muộn"
              value={attendance?.late_count ?? 0}
            />
            <AttendanceStat
              label="Vắng"
              value={attendance?.absent_count ?? 0}
            />
            <AttendanceStat
              label="Có phép"
              value={attendance?.excused_count ?? 0}
            />
          </div>

          <Card className="mt-4">
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
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Buổi {session.session_number} ·{" "}
                          {formatDateTime(session.starts_at)}
                        </p>
                        {session.myAttendance?.note && (
                          <p className="text-muted-foreground text-xs">
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
          </Card>
        </TabsContent>

        {/* --- Tài liệu --- */}
        <TabsContent value="materials" className="mt-4">
          <Card>
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
          </Card>
        </TabsContent>
      </Tabs>
    </>
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
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-sm break-words whitespace-pre-line">
        {value ?? "—"}
      </p>
    </div>
  );
}

function AttendanceStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card>
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
