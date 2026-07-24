import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";

import { ClassFormDialog } from "@/features/classes/components/class-form-dialog";
import { TeacherAssignments } from "@/features/classes/components/teacher-assignments";
import {
  getClassById,
  getCourseOptionsForClasses,
} from "@/features/classes/server/queries";
import { EnrollmentPanel } from "@/features/enrollments/components/enrollment-panel";
import {
  getClassEnrollments,
  getEnrollableStudents,
  getTransferTargets,
} from "@/features/enrollments/server/queries";
import { getActiveTeacherOptions } from "@/features/teachers/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
import { isOpenEnrollment } from "@/lib/domain/enrollment";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Chi tiết lớp học" };


export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;
  const [classRecord, courses, teachers, enrollments, enrollableStudents, transferTargets] =
    await Promise.all([
      getClassById(id),
      getCourseOptionsForClasses(),
      getActiveTeacherOptions(),
      getClassEnrollments(id),
      getEnrollableStudents(),
      getTransferTargets(id),
    ]);

  if (!classRecord) notFound();

  const openEnrollments = classRecord.enrollments.filter((enrollment) =>
    isOpenEnrollment(enrollment.status),
  );
  const sessions = [...classRecord.class_sessions].sort(
    (a, b) => a.session_number - b.session_number,
  );

  return (
    <>
      <Link
        href="/admin/classes"
        className="text-text-secondary hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Danh sách lớp học
      </Link>

      <PageHeader
        title={classRecord.name}
        description={`${classRecord.code} · ${classRecord.course?.title ?? "Chưa có khóa học"}`}
        action={
          /* ⛔ KHÔNG truyền `trigger` từ đây. `ClassFormDialog` là Client
             Component và đưa con của nó vào `DialogTrigger asChild`; một React
             element dựng ở Server Component đi qua ranh giới RSC thì Radix
             `Children.only()` CÓ LÚC không thấy đúng một phần tử → ném
             "Primitive.button failed to slot onto its children" → cả trang rơi
             vào error boundary. Đo được 47/120 lượt hỏng trước khi sửa
             (`UX-UIUX-M00-025`). Nút "Sửa lớp" nay do chính dialog dựng. */
          <ClassFormDialog courses={courses} classRecord={classRecord} />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={CLASS_STATUS_LABELS[classRecord.status]}
          tone={CLASS_STATUS_TONE[classRecord.status]}
        />
        <span className="text-text-secondary text-sm">
          {DELIVERY_MODE_LABELS[classRecord.delivery_mode]} ·{" "}
          {openEnrollments.length}/{classRecord.capacity} học viên
        </span>
      </div>

      {/* `min-w-0` trên từng cột: con grid mặc định `min-width: auto` nên không
          co được dưới min-content — `DS-039`, đo được trang này tràn **193px**
          ở 360px trước khi sửa (mốc tràn nặng nhất của cả khu Quản trị). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2>Thông tin lớp</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Khóa học" value={classRecord.course?.title} />
              <Field
                label="Ngày khai giảng"
                value={formatDateOnly(classRecord.start_date)}
              />
              <Field
                label="Dự kiến kết thúc"
                value={formatDateOnly(classRecord.expected_end_date)}
              />
              <Field
                label="Số buổi"
                value={
                  classRecord.planned_session_count
                    ? `${classRecord.planned_session_count} buổi`
                    : null
                }
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

          <Card className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle asChild className="text-base">
                <h2>Địa điểm học</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 sm:grid-cols-2">
              <Field label="Tên địa điểm" value={classRecord.location_name} />
              <Field label="Địa chỉ" value={classRecord.address} />
              <Field
                label="Phòng học trực tuyến"
                value={classRecord.meeting_url}
              />
              <Field
                label="Ghi chú linh hoạt"
                value={classRecord.location_note}
              />
            </CardContent>
          </Card>

          <TeacherAssignments
            classId={classRecord.id}
            assignment={classRecord.class_teachers}
            teachers={teachers}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="gap-4 py-4">
            <CardHeader className="flex-row items-center justify-between gap-3 px-4">
              <div className="min-w-0">
                <CardTitle asChild className="text-base">
                  <h2>Lịch &amp; buổi học</h2>
                </CardTitle>
                <p className="text-text-secondary mt-1 text-sm">
                  {classRecord.class_schedules.length === 0
                    ? "Lớp linh hoạt hoặc chưa cấu hình lịch lặp."
                    : `${classRecord.class_schedules.length} lịch lặp đã cấu hình.`}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/schedule?class=${classRecord.id}`}>
                  <CalendarDays className="size-4" aria-hidden />
                  Quản lý lịch
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-4">
              <dl className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <dd className="text-2xl font-semibold tabular-nums">
                    {sessions.length}
                  </dd>
                  <dt className="text-text-secondary text-sm">Buổi đã sinh</dt>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <dd className="text-2xl font-semibold tabular-nums">
                    {
                      sessions.filter(
                        (session) => session.status === "completed",
                      ).length
                    }
                  </dd>
                  <dt className="text-text-secondary text-sm">Buổi đã dạy</dt>
                </div>
              </dl>
            </CardContent>
          </Card>

          <EnrollmentPanel
            classId={classRecord.id}
            capacity={classRecord.capacity}
            enrollments={enrollments}
            enrollableStudents={enrollableStudents}
            transferTargets={transferTargets}
          />
        </div>
      </div>
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
    // `min-w-0` + `break-words`: ô này chứa cả URL phòng học trực tuyến, là
    // chuỗi không có dấu cách nên nếu không cho ngắt thì chính nó ghim bề rộng
    // min-content của cả cột và kéo trang tràn ngang.
    <div className="min-w-0">
      <p className="text-text-secondary text-sm">{label}</p>
      <p className="mt-0.5 text-sm break-words whitespace-pre-line">
        {value ?? "—"}
      </p>
    </div>
  );
}
