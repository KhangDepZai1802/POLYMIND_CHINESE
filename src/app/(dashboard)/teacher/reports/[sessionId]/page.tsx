import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Lock } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCourseCurriculum } from "@/features/courses/server/queries";
import { SessionReportFormView } from "@/features/session-reports/components/session-report-form";
import { getSessionReportEditorData } from "@/features/session-reports/server/queries";
import { requireTeaching } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Báo cáo buổi dạy" };

export default async function TeacherSessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireTeaching("super_admin");
  const { sessionId } = await params;

  // `null` khi RLS không cho đọc ⇒ 404. Không có lớp kiểm quyền nào ở app;
  // chốt chặn nằm ở DB.
  const data = await getSessionReportEditorData(sessionId);
  if (!data) notFound();

  const curriculum = await getCourseCurriculum(data.session.courseId);
  const lessons = curriculum.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleId: module.id,
      moduleTitle: module.title,
    })),
  );

  return (
    <>
      <Link
        href="/teacher/reports"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Về danh sách báo cáo
      </Link>

      <PageHeader
        title={`Báo cáo · Buổi ${data.session.sessionNumber}`}
        description={`${data.session.classCode} — ${data.session.className} · ${formatDate(
          data.session.startsAt,
        )} · ${formatTime(data.session.startsAt)}–${formatTime(data.session.endsAt)}`}
      />

      {/*
        🔴 CỔNG ĐIỂM DANH — tầng thứ hai trong ba tầng.
        Danh sách đã dẫn giáo viên sang điểm danh trước, nhưng gõ thẳng URL thì
        vẫn vào được tới đây; chặn ở đây, và chặn LẦN CUỐI ở RPC.
        Có lối ra rõ ràng chứ không phải ngõ cụt (`UX-MOBILE-3`).
      */}
      {!data.attendance.complete ? (
        <Card>
          <CardContent className="grid gap-4 py-6">
            <Alert>
              <ClipboardCheck className="size-4" aria-hidden />
              <AlertDescription>
                <strong>Cần điểm danh xong trước khi làm báo cáo.</strong> Mục 2
                của báo cáo lấy số liệu thẳng từ điểm danh, nên chưa điểm danh
                thì chưa có gì để báo cáo.
              </AlertDescription>
            </Alert>

            <p className="text-text-secondary text-sm">
              Buổi này mới điểm danh{" "}
              <strong className="text-foreground tabular-nums">
                {data.attendance.marked}/{data.attendance.rosterSize}
              </strong>{" "}
              học viên.
            </p>

            <div>
              <Link
                href={`/teacher/attendance?session=${data.session.id}`}
                className={buttonVariants()}
              >
                <ClipboardCheck className="size-4" aria-hidden />
                Đi điểm danh
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <SessionReportFormView data={data} lessons={lessons} userId={user.id} />
      )}

      {data.report.status === "submitted" && (
        <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
          <Lock className="size-3.5" aria-hidden />
          Báo cáo đã gửi và được khoá — số liệu chuyên cần giữ nguyên như lúc ký.
        </p>
      )}
    </>
  );
}
