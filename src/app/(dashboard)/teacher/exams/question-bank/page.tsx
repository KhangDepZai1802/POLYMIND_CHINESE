import { QuestionBankPage } from "@/features/question-bank/components/question-bank-page";
import { requireTeaching } from "@/lib/auth/session";

export default async function ExamQuestionBankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireTeaching();
  return <QuestionBankPage kind="exam" filters={await searchParams} />;
}
