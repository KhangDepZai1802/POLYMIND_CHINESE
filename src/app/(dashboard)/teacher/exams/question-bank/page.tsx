import { QuestionBankPage } from "@/features/question-bank/components/question-bank-page";
import { requireRole } from "@/lib/auth/session";

export default async function ExamQuestionBankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("teacher");
  return <QuestionBankPage kind="exam" filters={await searchParams} />;
}
