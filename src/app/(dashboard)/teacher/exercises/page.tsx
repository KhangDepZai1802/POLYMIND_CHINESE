import { ExerciseDashboard } from "@/features/exercises/teacher/exercise-dashboard";
import { getExerciseTeacherData } from "@/features/exercises/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StepHint } from "@/components/shared/step-hint";
import { requireRole } from "@/lib/auth/session";
export default async function TeacherExercisesPage() {
  await requireRole("teacher");
  const data = await getExerciseTeacherData();
  return (
    <>
      <AssessmentTabs module="exercises" />
      <PageHeader
        title="Giao bài tập cho lớp"
        description="Chọn một bộ bài tập đã khóa, giao cho lớp, rồi theo dõi, chấm và công bố kết quả."
      />
      <StepHint module="exercises" step={3} />
      <ExerciseDashboard {...data} />
    </>
  );
}
