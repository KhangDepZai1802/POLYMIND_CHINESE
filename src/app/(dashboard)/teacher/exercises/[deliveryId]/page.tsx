import { notFound } from "next/navigation";
import { GradingWorkspace } from "@/features/assessment-results/components/grading-workspace";
import { getExerciseGradingData } from "@/features/exercises/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export default async function ExerciseGradingPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  await requireRole("teacher", "super_admin");
  const { deliveryId } = await params;
  const delivery = await getExerciseGradingData(deliveryId);
  if (!delivery) notFound();
  return (
    <>
      <PageHeader title="Chấm bài tập" description="Chấm theo học viên và từng câu; tổng điểm được DB tính lại." />
      <GradingWorkspace kind="exercise" delivery={delivery as never} />
    </>
  );
}
