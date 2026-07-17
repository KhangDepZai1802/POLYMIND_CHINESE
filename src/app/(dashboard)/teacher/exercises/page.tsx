import { ExerciseDashboard } from "@/features/exercises/teacher/exercise-dashboard";
import { getExerciseTeacherData } from "@/features/exercises/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
export default async function TeacherExercisesPage() {
  await requireRole("teacher");
  const data = await getExerciseTeacherData();
  return (
    <>
      <PageHeader
        title="Bài tập"
        description="Tạo bộ, giao lớp, theo dõi, chấm và công bố kết quả."
      />
      <ExerciseDashboard {...data} />
    </>
  );
}
