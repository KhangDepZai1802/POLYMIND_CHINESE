import { getStudentExerciseDeliveries } from "@/features/exercises/server/queries";
import { StudentExerciseList } from "@/features/exercises/student/exercise-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
export default async function StudentExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("student");
  const [deliveries, query] = await Promise.all([
    getStudentExerciseDeliveries(),
    searchParams,
  ]);
  const initialTab = [
    "todo",
    "doing",
    "submitted",
    "graded",
    "overdue",
  ].includes(query.tab ?? "")
    ? (query.tab as "todo" | "doing" | "submitted" | "graded" | "overdue")
    : "todo";
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Bài tập"
        description="Cần làm · Đang làm · Đã nộp · Đã chấm · Quá hạn"
      />
      <StudentExerciseList deliveries={deliveries} initialTab={initialTab} />
    </div>
  );
}
