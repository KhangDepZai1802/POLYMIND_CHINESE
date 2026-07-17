import { notFound } from "next/navigation";
import { AssessmentResultView } from "@/features/assessment-results/components/result-view";
import { getMyAssessmentResult } from "@/features/assessment-results/server/queries";
import { PageHeader } from "@/components/shared/page-header";
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
    <>
      <PageHeader title="Kết quả bài tập" description="Điểm, feedback và đáp án theo chế độ công bố của giáo viên." />
      <AssessmentResultView kind="exercise" result={result as never} />
    </>
  );
}
