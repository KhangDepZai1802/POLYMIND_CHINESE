import Link from "next/link";
import {
  getCurrentTimestamp,
  getStudentExams,
} from "@/features/exams/server/queries";
import { ExamWaitingRoom } from "@/features/exams/student/exam-waiting-room";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
export default async function StudentExamsPage() {
  await requireRole("student");
  const exams = await getStudentExams();
  const now = getCurrentTimestamp();
  return (
    <>
      <PageHeader
        title="Kiểm tra / Thi"
        description="Kiểm tra âm thanh và quy định trước khi bắt đầu. Mỗi kỳ thi có một lượt hợp lệ."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {exams.map((exam) => {
          const active = exam.attempts.find((a) => a.status === "in_progress");
          const canStart =
            now >= new Date(exam.opens_at).getTime() &&
            now < new Date(exam.closes_at).getTime();
          const result = exam.results_published_at
            ? exam.attempts[0]
            : undefined;
          const submitted = exam.attempts.some((attempt) => attempt.submitted_at);
          return (
            <Card key={exam.id}>
              <CardHeader>
                <CardTitle>{exam.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  {exam.class?.code} — {exam.class?.name}
                </p>
                <p>
                  {new Date(exam.opens_at).toLocaleString("vi-VN")} →{" "}
                  {new Date(exam.closes_at).toLocaleString("vi-VN")}
                </p>
                <p>{exam.duration_minutes} phút · Không copy/cut/paste</p>
                {result && (
                  <div className="space-y-2">
                    <p className="font-semibold text-emerald-700">
                      Điểm: {result.final_score_100}/100
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/student/exams/results/${result.id}`}>
                        Xem kết quả
                      </Link>
                    </Button>
                  </div>
                )}
                {active ? (
                  <Button asChild>
                    <Link
                      href={`/student/exams/${exam.id}/attempt/${active.id}`}
                    >
                      Tiếp tục thi
                    </Link>
                  </Button>
                ) : submitted ? (
                  <Button disabled>Đã nộp — chờ chấm</Button>
                ) : (
                  <ExamWaitingRoom deliveryId={exam.id} canStart={canStart && !result} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
