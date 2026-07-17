import { QuestionBankPage } from "@/features/question-bank/components/question-bank-page";
import { requireRole } from "@/lib/auth/session";

export default async function ExerciseQuestionBankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("teacher");
  return <QuestionBankPage kind="exercise" filters={await searchParams} />;
}
