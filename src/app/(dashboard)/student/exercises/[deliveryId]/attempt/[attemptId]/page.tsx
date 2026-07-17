import { notFound } from "next/navigation";
import { ExerciseAttempt } from "@/features/exercises/student/exercise-attempt";
import { getExerciseAttemptPayload } from "@/features/exercises/server/queries";
import { requireRole } from "@/lib/auth/session";
export default async function ExerciseAttemptPage({
  params,
}: {
  params: Promise<{ deliveryId: string; attemptId: string }>;
}) {
  await requireRole("student");
  const { attemptId } = await params;
  let payload: Awaited<ReturnType<typeof getExerciseAttemptPayload>>;
  try {
    payload = await getExerciseAttemptPayload(attemptId);
  } catch {
    return notFound();
  }
  return <ExerciseAttempt payload={payload as never} />;
}
