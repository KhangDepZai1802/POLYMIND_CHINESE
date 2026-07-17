import { notFound } from "next/navigation";
import { ExamAttempt } from "@/features/exams/student/exam-attempt";
import { getExamAttemptPayload } from "@/features/exams/server/queries";
import { requireRole } from "@/lib/auth/session";
export default async function ExamAttemptPage({
  params,
}: {
  params: Promise<{ deliveryId: string; attemptId: string }>;
}) {
  await requireRole("student");
  const { attemptId } = await params;
  let payload: Awaited<ReturnType<typeof getExamAttemptPayload>>;
  try {
    payload = await getExamAttemptPayload(attemptId);
  } catch {
    return notFound();
  }
  return <ExamAttempt payload={payload as never} />;
}
