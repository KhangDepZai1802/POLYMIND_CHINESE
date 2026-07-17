import { notFound } from "next/navigation";
import { GradingWorkspace } from "@/features/assessment-results/components/grading-workspace";
import { getExamGradingData } from "@/features/exams/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export default async function ExamGradingPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  await requireRole("teacher", "super_admin");
  const { deliveryId } = await params;
  const delivery = await getExamGradingData(deliveryId);
  if (!delivery) notFound();
  return (
    <>
      <PageHeader title="Chấm kỳ thi" description="Sự kiện integrity chỉ để tham khảo, không tự động kết luận gian lận." />
      <GradingWorkspace kind="exam" delivery={delivery as never} />
    </>
  );
}
