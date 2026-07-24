import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
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
import {
  getClassById,
  getClassProgress,
} from "@/features/classes/server/queries";
import { MaterialsManager } from "@/features/courses/components/materials-manager";
import {
  getCourseCurriculum,
  getCourseMaterials,
} from "@/features/courses/server/queries";
import { SessionCalendar } from "@/features/schedules/components/schedule-manager";
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
import { isOpenEnrollment } from "@/lib/domain/enrollment";
import {
  ASSESSMENT_TYPE_LABELS,
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONE,
  EXERCISE_DELIVERY_STATUS_LABELS,
  EXERCISE_DELIVERY_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Chi tiết lớp học" };

/**
 * Nguồn sự thật duy nhất của 8 tab: dùng cho cả `TabsTrigger` lẫn việc kiểm
 * `?tab=` từ URL, nên không thể lệch nhau.
 */
const CLASS_TABS = [
  { value: "overview", label: "Tổng quan" },
  { value: "schedule", label: "Lịch/Buổi" },
  { value: "students", label: "Học viên" },
  { value: "attendance", label: "Điểm danh" },
  { value: "exercises", label: "Bài tập" },
  { value: "exams", label: "Kiểm tra" },
  { value: "progress", label: "Tiến độ" },
  { value: "materials", label: "Tài liệu" },
] as const;

export default async function TeacherClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const { tab } = await searchParams;

  // Fail-closed: giá trị lạ trong URL rơi về tab đầu thay vì render khung rỗng.
  const activeTab =
    CLASS_TABS.find((item) => item.value === tab)?.value ?? "overview";

  // Không tự kiểm teacher_id ở app: RLS trên `classes` quy về `class_teachers`.
  // UUID ngoài phạm vi trả null và đi thẳng tới 404, không lộ lớp có tồn tại.
  const classRecord = await getClassById(id);
  if (!classRecord?.course) notFound();

  const [progressRows, curriculum, materials] = await Promise.all([
    getClassProgress(id),
    getCourseCurriculum(classRecord.course.id),
    getCourseMaterials(classRecord.course.id),
  ]);

  const openEnrollments = classRecord.enrollments.filter((enrollment) =>
    isOpenEnrollment(enrollment.status),
  );
  const openEnrollmentIds = new Set(
    openEnrollments.map((enrollment) => enrollment.id),
  );
  const sessions = [...classRecord.class_sessions].sort(
    (a, b) => a.session_number - b.session_number,
  );
  const schedules = [...classRecord.class_schedules].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  );
  const progressByEnrollment = new Map(
    progressRows.map((progress) => [progress.enrollment_id, progress]),
  );
  const absentCountsByEnrollment = new Map<string, number>();
  for (const session of sessions) {
    for (const record of session.attendance_records) {
      if (record.status !== "absent") continue;
      absentCountsByEnrollment.set(
        record.enrollment_id,
        (absentCountsByEnrollment.get(record.enrollment_id) ?? 0) + 1,
      );
    }
  }

  return (
    <>
      <Link
        href="/teacher/classes"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Lớp của tôi
      </Link>

      <PageHeader
        title={classRecord.name}
        description={`${classRecord.code} · ${classRecord.course.title}`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={CLASS_STATUS_LABELS[classRecord.status]}
          tone={CLASS_STATUS_TONE[classRecord.status]}
        />
        <span className="text-muted-foreground text-sm">
          {DELIVERY_MODE_LABELS[classRecord.delivery_mode]} ·{" "}
          {openEnrollments.length}/{classRecord.capacity} học viên ·{" "}
          {sessions.length}/{classRecord.planned_session_count ?? "—"} buổi
        </span>
      </div>

      <Tabs value={activeTab} activationMode="manual">
        {/* `tabIndex={0}` + vòng focus: ở 360px tám tab không đủ chỗ nên dải này
            cuộn ngang. Radix `Tabs` dùng **roving tabindex** — chỉ tab đang chọn
            có `tabindex=0`, các tab còn lại là `-1` — nên "bên trong có link"
            KHÔNG làm vùng cuộn đi được bằng bàn phím; người dùng bàn phím không
            tới được các tab bên phải (axe `scrollable-region-focusable`).
            Đúng lỗi `UX-UIUX-M21-009` đã sửa ở `/student/class`, sửa đúng bằng
            cách màn đó làm (`P17-T5`). */}
        <nav
          aria-label="Khu vực của lớp"
          tabIndex={0}
          className="bg-muted focus-visible:ring-ring overflow-x-auto rounded-lg pb-1 focus-visible:ring-2 focus-visible:outline-none"
          style={{
            // Bóng mép chỉ hiện khi CÒN nội dung cuộn, tắt khi đã cuộn hết.
            // Hai lớp `local` mang màu nền cuộn theo nội dung và che hai lớp
            // `scroll` đứng yên phía dưới — thuần CSS, không thêm JS.
            backgroundImage:
              "linear-gradient(to right, var(--muted), transparent)," +
              "linear-gradient(to left, var(--muted), transparent)," +
              "linear-gradient(to right, rgb(0 0 0 / 0.14), transparent)," +
              "linear-gradient(to left, rgb(0 0 0 / 0.14), transparent)",
            backgroundPosition:
              "left center, right center, left center, right center",
            backgroundSize: "28px 100%, 28px 100%, 12px 100%, 12px 100%",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "local, local, scroll, scroll",
          }}
        >
          <TabsList className="min-w-max bg-transparent">
            {CLASS_TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} asChild>
                <Link
                  href={`/teacher/classes/${id}?tab=${item.value}`}
                  scroll={false}
                >
                  {item.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </nav>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle asChild className="flex items-center gap-2 text-base">
                  <h2>
                    <School className="size-4" aria-hidden />
                    Thông tin lớp
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Khóa học" value={classRecord.course.title} />
                <Field label="Mã khóa" value={classRecord.course.code} />
                <Field
                  label="Khai giảng"
                  value={formatDate(classRecord.start_date)}
                />
                <Field
                  label="Dự kiến kết thúc"
                  value={formatDate(classRecord.expected_end_date)}
                />
                <Field
                  label="Thời lượng"
                  value={
                    classRecord.session_duration_minutes
                      ? `${classRecord.session_duration_minutes} phút/buổi`
                      : null
                  }
                />
                <Field label="Đối tượng" value={classRecord.target_audience} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle asChild className="flex items-center gap-2 text-base">
                  <h2>
                    <MapPin className="size-4" aria-hidden />
                    Địa điểm học
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Hình thức"
                  value={DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                />
                <Field label="Tên địa điểm" value={classRecord.location_name} />
                <Field label="Địa chỉ" value={classRecord.address} />
                <Field label="Ghi chú" value={classRecord.location_note} />
                {classRecord.meeting_url && (
                  <div className="sm:col-span-2">
                    <p className="text-text-secondary text-sm">
                      Phòng học trực tuyến
                    </p>
                    <a
                      href={classRecord.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Mở phòng học trực tuyến trong tab mới: ${classRecord.meeting_url}`}
                      className="text-primary mt-0.5 inline-flex max-w-full items-center gap-1 text-sm hover:underline"
                    >
                      <span className="min-w-0 truncate">
                        {classRecord.meeting_url}
                      </span>
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle asChild className="flex items-center gap-2 text-base">
                  <h2>
                    <Users className="size-4" aria-hidden />
                    Đội ngũ giảng dạy
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {classRecord.class_teachers && [classRecord.class_teachers].map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {assignment.teacher?.profile?.full_name ??
                            "Giáo viên"}
                        </p>
                        <p className="text-text-secondary text-sm">
                          {assignment.teacher?.teacher_code ?? "—"}
                          {assignment.teacher?.specialization
                            ? ` · ${assignment.teacher.specialization}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge label="Giáo viên phụ trách" tone="info" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle asChild className="flex items-center gap-2 text-base">
                <h2>
                  <CalendarDays className="size-4" aria-hidden />
                  Lịch học lặp
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Lớp chưa có lịch lặp"
                  description="Đây có thể là lớp học theo lịch linh hoạt. Các buổi học thủ công vẫn xuất hiện bên dưới."
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
                      <span className="text-text-secondary ml-auto text-sm">
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
              <CardTitle asChild className="text-base">
                <h2>Danh sách buổi học ({sessions.length})</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Chưa có buổi học nào"
                  description="Quản trị viên chưa sinh hoặc thêm buổi học cho lớp này."
                />
              ) : (
                <SessionCalendar mode="teacher" sessions={sessions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle asChild className="text-base">
                <h2>
                  Học viên ({openEnrollments.length} đang mở /{" "}
                  {classRecord.enrollments.length} lượt học)
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {classRecord.enrollments.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Lớp chưa có học viên"
                  description="Học viên sẽ xuất hiện sau khi được ghi danh."
                />
              ) : (
                <ul className="divide-y">
                  {classRecord.enrollments.map((enrollment) => {
                    const progress = progressByEnrollment.get(enrollment.id);
                    return (
                      <li
                        key={enrollment.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {enrollment.student?.full_name ?? "Học viên"}
                          </p>
                          <p className="text-text-secondary text-sm">
                            {enrollment.student?.student_code ?? "—"} · Ghi danh{" "}
                            {formatDate(enrollment.enrolled_on)}
                          </p>
                        </div>
                        <span className="text-text-secondary text-sm">
                          Tiến độ {formatPercent(progress?.progress_percent)}
                        </span>
                        <StatusBadge
                          label={ENROLLMENT_STATUS_LABELS[enrollment.status]}
                          tone={ENROLLMENT_STATUS_TONE[enrollment.status]}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle asChild className="flex items-center gap-2 text-base">
                <h2>
                  <ClipboardCheck className="size-4" aria-hidden />
                  Điểm danh theo buổi
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="Chưa có buổi để điểm danh"
                  description="Khi lớp có buổi học, bạn có thể mở roster ngay tại đây."
                />
              ) : (
                <ul className="divide-y">
                  {sessions.map((session) => {
                    const markedCount = session.attendance_records.filter(
                      (record) => openEnrollmentIds.has(record.enrollment_id),
                    ).length;
                    const isComplete =
                      openEnrollments.length > 0 &&
                      markedCount >= openEnrollments.length;

                    return (
                      <li
                        key={session.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            Buổi {session.session_number} ·{" "}
                            {formatDateTime(session.starts_at)}
                          </p>
                          <p className="text-text-secondary text-sm">
                            {openEnrollments.length === 0
                              ? "Lớp chưa có học viên đang mở"
                              : `Đã điểm danh ${markedCount}/${openEnrollments.length}`}
                          </p>
                        </div>
                        <StatusBadge
                          label={isComplete ? "Đã đủ" : "Chưa đủ"}
                          tone={isComplete ? "success" : "warning"}
                        />
                        <Button
                          asChild
                          size="sm"
                          variant={isComplete ? "outline" : "default"}
                        >
                          <Link
                            href={`/teacher/attendance?session=${session.id}`}
                          >
                            {isComplete ? "Xem / sửa" : "Điểm danh"}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exercises" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button asChild size="sm">
              <Link href="/teacher/exercises">
                Quản lý bài tập
              </Link>
            </Button>
          </div>
          {classRecord.exercise_deliveries.length === 0 ? (
            <EmptyPanel
              icon={FileCheck2}
              title="Chưa có bài tập"
              description="Tạo bản nháp, đính kèm đề bài rồi giao cho học viên bằng một hành động riêng."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {classRecord.exercise_deliveries.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {assignment.title}
                        </p>
                        <p className="text-text-secondary text-sm">
                          Hạn {formatDateTime(assignment.due_at)} ·{" "}
                          {assignment.attempts.filter((attempt) => attempt.submitted_at).length} bài nộp
                        </p>
                      </div>
                      <StatusBadge
                        label={
                          EXERCISE_DELIVERY_STATUS_LABELS[assignment.status]
                        }
                        tone={EXERCISE_DELIVERY_STATUS_TONE[assignment.status]}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button asChild size="sm">
              <Link href="/teacher/exams">
                Quản lý bài kiểm tra
              </Link>
            </Button>
          </div>
          {classRecord.exam_deliveries.length === 0 ? (
            <EmptyPanel
              icon={GraduationCap}
              title="Chưa có bài kiểm tra"
              description="Dựng bộ đề, lên lịch kỳ thi và chấm từng câu trong module Thi."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {classRecord.exam_deliveries.map((assessment) => (
                    <li
                      key={assessment.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {assessment.title}
                        </p>
                        <p className="text-text-secondary text-sm">
                          {ASSESSMENT_TYPE_LABELS[assessment.exam_type]} ·{" "}
                          {formatDate(assessment.opens_at)} ·{" "}
                          {assessment.attempts.filter((attempt) => attempt.graded_at).length} kết quả
                        </p>
                      </div>
                      <StatusBadge
                        label={
                          assessment.published_at ? "Đã công bố" : "Bản nháp"
                        }
                        tone={assessment.published_at ? "success" : "neutral"}
                      />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/teacher/exams/${assessment.id}`}>
                          Theo dõi & chấm
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          {progressRows.length === 0 ? (
            <EmptyPanel
              icon={Target}
              title="Chưa có dữ liệu tiến độ"
              description="Tiến độ được hệ thống tính từ bài học, chuyên cần, bài tập và kiểm tra."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle asChild className="text-base">
                  <h2>Tiến độ học viên</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {progressRows.map((progress) => {
                    const enrollment = classRecord.enrollments.find(
                      (item) => item.id === progress.enrollment_id,
                    );
                    const percent = clampPercent(progress.progress_percent);

                    return (
                      <li
                        key={progress.enrollment_id}
                        className="space-y-3 px-5 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {enrollment?.student?.full_name ?? "Học viên"}
                            </p>
                            <p className="text-text-secondary text-sm">
                              {enrollment?.student?.student_code ?? "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              label={
                                progress.is_completion_ready
                                  ? "Đủ điều kiện"
                                  : "Chưa đủ điều kiện"
                              }
                              tone={
                                progress.is_completion_ready
                                  ? "success"
                                  : "warning"
                              }
                            />
                            <span className="w-12 text-right text-sm font-semibold tabular-nums">
                              {formatPercent(progress.progress_percent)}
                            </span>
                          </div>
                        </div>
                        <div
                          className="bg-muted h-2 overflow-hidden rounded-full"
                          role="progressbar"
                          aria-label={`Tiến độ của ${enrollment?.student?.full_name ?? "học viên"}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={percent}
                        >
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-text-secondary grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                          <span>
                            Điểm chuyên cần:{" "}
                            {formatAttendanceScore(
                              progress.enrollment_id
                                ? absentCountsByEnrollment.get(
                                    progress.enrollment_id,
                                  )
                                : undefined,
                            )}
                            /10
                          </span>
                          <span>
                            Bài học: {progress.completed_lessons ?? 0}/
                            {progress.total_lessons ?? 0}
                          </span>
                          <span>
                            Bài tập: {progress.submitted_exercises ?? 0}/
                            {progress.total_exercises ?? 0}
                          </span>
                          <span>
                            Điểm TB: {formatScore(progress.avg_score)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <MaterialsManager
            courseId={classRecord.course.id}
            materials={materials}
            modules={curriculum}
          />
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
      <p className="text-text-secondary text-sm">{label}</p>
      <p className="mt-0.5 text-sm break-words whitespace-pre-line">
        {value ?? "—"}
      </p>
    </div>
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
