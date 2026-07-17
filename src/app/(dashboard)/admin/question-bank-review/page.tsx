import { ReviewQueue } from "@/features/question-bank/components/review-queue";
import { getQuestionReviewRequests } from "@/features/question-bank/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export default async function QuestionBankReviewPage() {
  await requireRole("super_admin");
  const requests = await getQuestionReviewRequests();
  return <><PageHeader title="Duyệt kho câu hỏi chung" description="Chỉ Super Admin có thể đưa câu hỏi vào phạm vi global." /><ReviewQueue requests={requests} /></>;
}
