import { SetManager } from "@/features/question-builder/components/set-manager";
import { getQuestionSets } from "@/features/question-builder/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StepHint } from "@/components/shared/step-hint";

export async function SetsPage({ kind }: { kind: "exercise" | "exam" }) {
  const data = await getQuestionSets(kind);
  const moduleName = kind === "exercise" ? "exercises" : "exams";
  return (
    <>
      <AssessmentTabs module={moduleName} />
      <PageHeader
        title={kind === "exercise" ? "Bộ bài tập" : "Bộ đề thi"}
        description="Ghép các câu hỏi thành một bộ, chia section nếu cần, xem trước đúng như học viên thấy rồi khóa bộ trước khi giao."
      />
      <StepHint module={moduleName} step={2} />
      <SetManager kind={kind} {...data} />
    </>
  );
}
