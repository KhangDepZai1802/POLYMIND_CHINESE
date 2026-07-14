import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Gauge, School } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionGradingBoard } from "@/features/assignments/components/submission-grading-board";
import { getSubmissionGradingBoard } from "@/features/assignments/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatScore } from "@/lib/dates";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Chấm bài tập" };

export default async function SubmissionGradingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const assignment = await getSubmissionGradingBoard(id);

  // Assignment ngoài lớp được phân công bị RLS lọc thành null → 404, không lộ dữ liệu.
  if (!assignment?.class) notFound();

  return (
    <>
      <PageHeader
        title={assignment.title}
        description="Đọc nguyên văn bài làm, tải tệp đính kèm và nhập điểm/nhận xét."
        action={
          <Button asChild variant="outline">
            <Link href={`/teacher/assignments?class=${assignment.class_id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại bài tập
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
          <StatusBadge
            label={ASSIGNMENT_STATUS_LABELS[assignment.status]}
            tone={ASSIGNMENT_STATUS_TONE[assignment.status]}
          />
          <span className="flex items-center gap-2">
            <School className="text-muted-foreground size-4" aria-hidden />
            {assignment.class.code} — {assignment.class.name}
          </span>
          <span className="flex items-center gap-2">
            <CalendarClock
              className="text-muted-foreground size-4"
              aria-hidden
            />
            Hạn {formatDateTime(assignment.due_at)}
          </span>
          <span className="flex items-center gap-2">
            <Gauge className="text-muted-foreground size-4" aria-hidden />
            Tối đa {formatScore(assignment.max_score)} điểm
          </span>
        </CardContent>
      </Card>

      <SubmissionGradingBoard
        assignmentId={assignment.id}
        classId={assignment.class_id}
        maxScore={assignment.max_score}
        submissions={assignment.submissions}
      />
    </>
  );
}
