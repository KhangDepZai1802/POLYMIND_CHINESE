import { PageHeader } from "@/components/shared/page-header";
import { StudentHomework } from "@/features/b2c/components/student-homework";
import { requireRole } from "@/lib/auth/session";

export const metadata = { title: "Bài tập" };

export default async function StudentB2CHomeworkPage() {
  await requireRole("student");
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="Bài tập"
        description="Xem đề bài, theo dõi hạn nộp và gửi bài làm cho giáo viên."
      />
      <StudentHomework />
    </div>
  );
}
