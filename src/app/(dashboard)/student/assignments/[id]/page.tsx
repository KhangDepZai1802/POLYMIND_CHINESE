import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Gauge, Paperclip } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionForm } from "@/features/submissions/components/submission-form";
import { getMyAssignmentDetail } from "@/features/submissions/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatScore } from "@/lib/dates";
import { formatFileSize } from "@/lib/domain/files";

export const metadata: Metadata = { title: "Nộp bài" };

export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("student");
  const { id } = await params;
  const assignment = await getMyAssignmentDetail(id);

  // Bài tập của lớp khác — hoặc bài còn ở dạng nháp — bị RLS lọc thành null → 404.
  if (!assignment) notFound();

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={`${assignment.class?.code ?? ""} — ${assignment.class?.name ?? ""}`}
        action={
          <Button asChild variant="outline">
            <Link href="/student/assignments">
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
          <span className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-4" aria-hidden />
            Hạn nộp {formatDateTime(assignment.due_at)}
          </span>
          <span className="flex items-center gap-2">
            <Gauge className="text-muted-foreground size-4" aria-hidden />
            Tối đa {formatScore(assignment.max_score)} điểm
          </span>
          <span className="text-muted-foreground text-xs">
            {assignment.allow_late_submission
              ? "Cho phép nộp sau hạn"
              : "Không nhận bài sau hạn"}
          </span>
        </CardContent>
      </Card>

      {assignment.instructions && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-base">Yêu cầu của giáo viên</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {assignment.instructions}
            </p>
          </CardContent>
        </Card>
      )}

      {assignment.assignment_attachments.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" aria-hidden />
              Đề bài đính kèm ({assignment.assignment_attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {assignment.assignment_attachments.map((attachment) => (
                <li key={attachment.id} className="px-5 py-3 text-sm">
                  {attachment.file_name}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {formatFileSize(attachment.size_bytes)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SubmissionForm
        assignmentId={assignment.id}
        maxScore={assignment.max_score}
        submission={assignment.submission}
      />
    </>
  );
}
