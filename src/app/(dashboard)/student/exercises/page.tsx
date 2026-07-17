import { getStudentExerciseDeliveries } from "@/features/exercises/server/queries";
import { StudentExerciseList } from "@/features/exercises/student/exercise-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
export default async function StudentExercisesPage() {
  await requireRole("student");
  const deliveries = await getStudentExerciseDeliveries();
  return (
    <>
      <PageHeader
        title="Bài tập"
        description="Cần làm · Đang làm · Đã nộp · Đã chấm · Quá hạn"
      />
      <StudentExerciseList deliveries={deliveries} />
    </>
  );
}
