import { ExerciseDashboard } from "@/features/exercises/teacher/exercise-dashboard";
import { getExerciseTeacherData } from "@/features/exercises/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
export default async function TeacherExercisesPage() {
  await requireRole("teacher");
  const data = await getExerciseTeacherData();
  return (
    <>
      <AssessmentTabs module="exercises" />
      <PageHeader
        title="Bài tập"
        description="Tạo bộ, giao lớp, theo dõi, chấm và công bố kết quả."
      />
      <ExerciseDashboard {...data} />
    </>
  );
}
