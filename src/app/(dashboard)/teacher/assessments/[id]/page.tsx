import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarClock, Gauge, School } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentScoreBoard } from "@/features/assessments/components/assessment-score-board";
import { getAssessmentScoreBoard } from "@/features/assessments/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatScore } from "@/lib/dates";
import { ASSESSMENT_TYPE_LABELS } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Nhập điểm bài kiểm tra" };

export default async function AssessmentScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const assessment = await getAssessmentScoreBoard(id);

  // Bài KT của lớp không được phân công bị RLS lọc thành null → 404, không lộ
  // tên lớp/tên bài. Đoán URL không phải là một đường vào.
  if (!assessment?.class) notFound();

  return (
    <>
      <PageHeader
        title={assessment.title}
        description="Nhập điểm tổng và 6 kỹ năng cho từng học viên, rà soát, rồi công bố kết quả."
        action={
          <Button asChild variant="outline">
            <Link href={`/teacher/assessments?class=${assessment.class_id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại danh sách
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
          <StatusBadge
            label={assessment.published_at ? "Đã công bố" : "Chưa công bố"}
            tone={assessment.published_at ? "success" : "neutral"}
          />
          <span className="flex items-center gap-2">
            <School className="text-muted-foreground size-4" aria-hidden />
            {assessment.class.code} — {assessment.class.name}
          </span>
          <span className="flex items-center gap-2">
            <CalendarClock
              className="text-muted-foreground size-4"
              aria-hidden
            />
            {ASSESSMENT_TYPE_LABELS[assessment.type]} ·{" "}
            {assessment.assessment_date
              ? formatDate(assessment.assessment_date)
              : "Chưa đặt ngày"}
          </span>
          <span className="flex items-center gap-2">
            <Gauge className="text-muted-foreground size-4" aria-hidden />
            Thang {formatScore(assessment.max_score)} điểm
          </span>
          {assessment.lesson && (
            <span className="flex items-center gap-2">
              <BookOpen className="text-muted-foreground size-4" aria-hidden />
              {assessment.lesson.title}
            </span>
          )}
        </CardContent>
      </Card>

      <AssessmentScoreBoard
        assessmentId={assessment.id}
        classId={assessment.class_id}
        maxScore={assessment.max_score}
        publishedAt={assessment.published_at}
        rows={assessment.rows}
      />
    </>
  );
}
