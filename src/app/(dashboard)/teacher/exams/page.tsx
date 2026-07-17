import { ExamDashboard } from "@/features/exams/teacher/exam-dashboard";
import { getExamTeacherData } from "@/features/exams/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
export default async function TeacherExamsPage() {
  await requireRole("teacher");
  const data = await getExamTeacherData();
  return (
    <>
      <PageHeader
        title="Kiểm tra / Thi"
        description="Bộ đề cố định, khung thi cùng ngày, timer DB và tự nộp khi hết giờ."
      />
      <ExamDashboard {...data} />
    </>
  );
}
