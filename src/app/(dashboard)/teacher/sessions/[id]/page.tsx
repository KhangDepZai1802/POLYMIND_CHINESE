import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseCurriculum } from "@/features/courses/server/queries";
import { SessionLogForm } from "@/features/sessions/components/session-log-form";
import { getSessionLog } from "@/features/sessions/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatTime } from "@/lib/dates";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Nhật ký buổi học" };

export default async function TeacherSessionLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher", "super_admin");
  const { id } = await params;
  const session = await getSessionLog(id);
  if (!session) notFound();

  const curriculum = await getCourseCurriculum(session.class.course.id);
  const lessons = curriculum.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleId: module.id,
      moduleTitle: module.title,
    })),
  );
  const selectedLesson = lessons.find(
    (lesson) => lesson.id === session.lesson_id,
  );

  return (
    <>
      <Link
        href={`/teacher/classes/${session.class.id}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Về lớp {session.class.code}
      </Link>

      <PageHeader
        title={`Nhật ký · Buổi ${session.session_number}`}
        description={`${session.class.code} — ${session.class.name}`}
        action={
          <Button asChild variant="outline">
            <Link href={`/teacher/attendance?session=${session.id}`}>
              <ClipboardCheck className="size-4" aria-hidden />
              Điểm danh
            </Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={CalendarClock}
          label="Thời gian (giờ Việt Nam)"
          value={`${formatDateTime(session.starts_at)}–${formatTime(session.ends_at)}`}
        />
        <SummaryCard
          icon={ClipboardCheck}
          label="Điểm danh"
          value={`${session.attendanceCount}/${session.openEnrollmentCount} học viên`}
        />
        <SummaryCard
          icon={BookOpenCheck}
          label="Tiến độ bài học"
          value={`${session.completedProgressCount}/${session.openEnrollmentCount} hoàn thành`}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={SESSION_STATUS_LABELS[session.status]}
          tone={SESSION_STATUS_TONE[session.status]}
        />
        {session.topic && (
          <span className="text-muted-foreground text-sm">
            Chủ đề dự kiến: {session.topic}
          </span>
        )}
      </div>

      {session.status === "scheduled" ? (
        <Card>
          <CardHeader>
            <CardTitle asChild className="text-base">
              <h2>Nội dung thực dạy</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SessionLogForm
              session={{
                id: session.id,
                lessonId: session.lesson_id,
                lessonLog: session.lesson_log,
                teacherNote: session.teacher_note,
              }}
              lessons={lessons}
            />
          </CardContent>
        </Card>
      ) : session.status === "completed" ? (
        <div className="space-y-5">
          <Alert>
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertDescription>
              Buổi đã hoàn tất lúc {formatDateTime(session.completed_at)}. Nhật
              ký được khóa để không ghi đè lịch sử.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle asChild className="text-base">
                <h2>{selectedLesson?.title ?? "Bài học đã dạy"}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReadOnlyField
                label="Nội dung thực dạy"
                value={session.lesson_log}
              />
              <ReadOnlyField
                label="Ghi chú nội bộ"
                value={session.teacher_note}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Alert>
          <CalendarClock className="size-4" aria-hidden />
          <AlertDescription>
            Buổi đã hủy hoặc đổi lịch nên không thể ghi nhật ký. Lịch sử vẫn
            được giữ nguyên.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-primary-50 text-primary-700 flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-text-secondary text-sm">{label}</p>
          {/* Không `truncate`: ở 640–768px mỗi thẻ chỉ còn ~148px cho chuỗi
              giờ, cắt đúng giờ kết thúc — dữ liệu chính của thẻ. Xuống dòng
              không vỡ layout vì `grid` kéo 3 thẻ cùng hàng bằng nhau. */}
          <p className="text-sm font-medium" title={value}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-text-secondary text-sm">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
