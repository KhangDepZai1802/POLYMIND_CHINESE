import type { Metadata } from "next";
import Link from "next/link";
import { FileText, School } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyEnrollment } from "@/features/student/server/queries";
import { getMyAssignments } from "@/features/submissions/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatScore } from "@/lib/dates";

export const metadata: Metadata = { title: "Bài tập" };

export default async function StudentAssignmentsPage() {
  await requireRole("student");
  const enrollment = await getMyEnrollment();

  if (!enrollment?.class) {
    return (
      <>
        <PageHeader
          title="Bài tập"
          description="Bài tập được giao và bài đã nộp."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Bài tập của lớp sẽ hiện ở đây sau khi bạn được xếp lớp."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const assignments = await getMyAssignments(enrollment.class.id);

  return (
    <>
      <PageHeader
        title="Bài tập"
        description={`${enrollment.class.code} — ${enrollment.class.name}`}
      />

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="Chưa có bài tập nào"
              description="Bài tập giáo viên giao sẽ hiện ở đây kèm hạn nộp."
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {assignments.map((assignment) => {
            const submission = assignment.submission;
            const overdue =
              !submission?.submitted_at &&
              assignment.due_at !== null &&
              new Date(assignment.due_at) < new Date();

            return (
              <li key={assignment.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{assignment.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Hạn {formatDateTime(assignment.due_at)} · Tối đa{" "}
                        {formatScore(assignment.max_score)} điểm
                        {submission?.graded_at &&
                          ` · Điểm của bạn: ${formatScore(submission.score)}`}
                      </p>
                    </div>

                    {submission?.is_late && (
                      <StatusBadge label="Nộp muộn" tone="warning" />
                    )}
                    {overdue && <StatusBadge label="Quá hạn" tone="warning" />}
                    <StatusBadge
                      label={
                        submission?.graded_at
                          ? "Đã chấm"
                          : submission?.submitted_at
                            ? "Đã nộp"
                            : "Chưa nộp"
                      }
                      tone={
                        submission?.graded_at
                          ? "info"
                          : submission?.submitted_at
                            ? "success"
                            : "neutral"
                      }
                    />

                    <Button
                      asChild
                      size="sm"
                      variant={submission?.submitted_at ? "outline" : "default"}
                    >
                      <Link href={`/student/assignments/${assignment.id}`}>
                        {submission?.graded_at
                          ? "Xem điểm"
                          : submission?.submitted_at
                            ? "Xem bài"
                            : "Nộp bài"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
