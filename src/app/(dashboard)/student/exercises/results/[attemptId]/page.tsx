import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AssessmentResultView } from "@/features/assessment-results/components/result-view";
import { getMyAssessmentResult } from "@/features/assessment-results/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";

export default async function ExerciseResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireRole("student");
  const { attemptId } = await params;
  let result: Awaited<ReturnType<typeof getMyAssessmentResult>>;
  try {
    result = await getMyAssessmentResult("exercise", attemptId);
  } catch {
    return notFound();
  }
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Kết quả bài tập"
        description="Xem điểm, nhận xét và đáp án theo lựa chọn công bố của giáo viên."
        action={
          <Button asChild variant="outline">
            <Link href="/student/exercises?tab=graded">
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại bài đã chấm
            </Link>
          </Button>
        }
      />
      <AssessmentResultView kind="exercise" result={result as never} />
    </div>
  );
}
