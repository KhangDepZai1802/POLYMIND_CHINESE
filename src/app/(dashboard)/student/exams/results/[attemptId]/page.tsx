import { notFound } from "next/navigation";
import { AssessmentResultView } from "@/features/assessment-results/components/result-view";
import { getMyAssessmentResult } from "@/features/assessment-results/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireRole("student");
  const { attemptId } = await params;
  let result: Awaited<ReturnType<typeof getMyAssessmentResult>>;
  try {
    result = await getMyAssessmentResult("exam", attemptId);
  } catch {
    return notFound();
  }
  return (
    <>
      <PageHeader title="Kết quả kỳ thi" description="Kết quả chỉ hiển thị sau khi giáo viên công bố." />
      <AssessmentResultView kind="exam" result={result as never} />
    </>
  );
}
