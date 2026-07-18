import { ExamDashboard } from "@/features/exams/teacher/exam-dashboard";
import { getExamTeacherData } from "@/features/exams/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StepHint } from "@/components/shared/step-hint";
import { requireRole } from "@/lib/auth/session";
export default async function TeacherExamsPage() {
  await requireRole("teacher");
  const data = await getExamTeacherData();
  return (
    <>
      <AssessmentTabs module="exams" />
      <PageHeader
        title="Lên lịch thi cho lớp"
        description="Chọn một đề đã khóa, lên lịch thi cùng khung giờ; timer chạy ở DB và tự nộp khi hết giờ."
      />
      <StepHint module="exams" step={3} />
      <ExamDashboard {...data} />
    </>
  );
}
