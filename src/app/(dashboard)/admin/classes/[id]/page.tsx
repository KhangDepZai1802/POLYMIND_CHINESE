import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil } from "lucide-react";

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
import { formatDate } from "@/lib/dates";
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
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Danh sách lớp học
      </Link>

      <PageHeader
        title={classRecord.name}
        description={`${classRecord.code} · ${classRecord.course?.title ?? "Chưa có khóa học"}`}
        action={
          <ClassFormDialog
            courses={courses}
            classRecord={classRecord}
            trigger={
              <Button variant="outline">
                <Pencil className="size-4" aria-hidden />
                Sửa lớp
              </Button>
            }
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={CLASS_STATUS_LABELS[classRecord.status]}
          tone={CLASS_STATUS_TONE[classRecord.status]}
        />
        <span className="text-muted-foreground text-sm">
          {DELIVERY_MODE_LABELS[classRecord.delivery_mode]} ·{" "}
          {openEnrollments.length}/{classRecord.capacity} học viên
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin lớp</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Khóa học" value={classRecord.course?.title} />
              <Field
                label="Ngày khai giảng"
                value={formatDate(classRecord.start_date)}
              />
              <Field
                label="Dự kiến kết thúc"
                value={formatDate(classRecord.expected_end_date)}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Địa điểm học</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Lịch & buổi học</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
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
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-semibold">{sessions.length}</p>
                  <p className="text-muted-foreground text-xs">Buổi đã sinh</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-semibold">
                    {
                      sessions.filter(
                        (session) => session.status === "completed",
                      ).length
                    }
                  </p>
                  <p className="text-muted-foreground text-xs">Buổi đã dạy</p>
                </div>
              </div>
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
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-sm break-words whitespace-pre-line">
        {value ?? "—"}
      </p>
    </div>
  );
}
