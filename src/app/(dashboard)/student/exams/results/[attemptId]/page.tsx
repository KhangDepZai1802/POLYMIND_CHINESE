import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AssessmentResultView } from "@/features/assessment-results/components/result-view";
import { getMyAssessmentResult } from "@/features/assessment-results/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Kết quả kỳ thi"
        description="Kết quả chỉ hiển thị sau khi giáo viên công bố."
        action={
          <Button asChild variant="outline">
            <Link href="/student/results">
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại danh sách kết quả
            </Link>
          </Button>
        }
      />
      <AssessmentResultView kind="exam" result={result as never} />
    </div>
  );
}
