import { SetManager } from "@/features/question-builder/components/set-manager";
import { getQuestionSets } from "@/features/question-builder/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";

export async function SetsPage({ kind }: { kind: "exercise" | "exam" }) {
  const data = await getQuestionSets(kind);
  return (
    <>
      <AssessmentTabs module={kind === "exercise" ? "exercises" : "exams"} />
      <PageHeader
        title={kind === "exercise" ? "Bộ bài tập" : "Bộ đề thi"}
        description="Dựng section/câu hỏi, xem trước bằng cùng renderer của học viên và khóa version bất biến trước khi giao."
      />
      <SetManager kind={kind} {...data} />
    </>
  );
}
