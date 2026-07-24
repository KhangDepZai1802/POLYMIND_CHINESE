import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  GraduationCap,
  PlayCircle,
  School,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCurrentTimestamp,
  getStudentExams,
} from "@/features/exams/server/queries";
import { ExamWaitingRoom } from "@/features/exams/student/exam-waiting-room";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";

type Exam = Awaited<ReturnType<typeof getStudentExams>>[number];
type Tone = "sky" | "cyan" | "amber" | "coral";

export default async function StudentExamsPage() {
  await requireRole("student");
  const exams = await getStudentExams();
  const now = getCurrentTimestamp();
  const states = exams.map((exam) => examState(exam, now));
  const ready = states.filter(
    (state) =>
      state.canStart && !state.active && !state.submitted && !state.result,
  ).length;
  const active = states.filter((state) => state.active).length;
  const submitted = states.filter(
    (state) => state.submitted && !state.result,
  ).length;
  const results = states.filter((state) => state.result).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Kiểm tra / Thi"
        description="Kiểm tra âm thanh và quy định trước khi bắt đầu. Mỗi kỳ thi có một lượt hợp lệ."
      />

      <section aria-labelledby="exam-overview-title" className="space-y-3">
        <div>
          <h2 id="exam-overview-title" className="text-lg font-semibold">
            Tổng quan kỳ thi
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Chuẩn bị thiết bị, theo dõi lượt đang mở và xem kết quả đã công bố.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ExamMetric
            icon={ShieldCheck}
            label="Cần chú ý"
            value={ready + active}
            detail={`${ready} sẵn sàng · ${active} đang thi`}
            tone="amber"
          />
          <ExamMetric
            icon={Clock3}
            label="Chờ chấm"
            value={submitted}
            detail="Đã nộp thành công"
            tone="sky"
          />
          <ExamMetric
            icon={Trophy}
            label="Có kết quả"
            value={results}
            detail="Đã được công bố"
            tone="cyan"
          />
          <ExamMetric
            icon={GraduationCap}
            label="Tổng kỳ thi"
            value={exams.length}
            detail="Trong lớp đang học"
            tone="coral"
          />
        </div>
      </section>

      {exams.length === 0 ? (
        <Card className="border-student-sky-border">
          <EmptyState
            icon={GraduationCap}
            title="Chưa có kỳ thi"
            description="Kỳ thi được giáo viên lên lịch sẽ xuất hiện tại đây."
          />
        </Card>
      ) : (
        <section aria-labelledby="exam-list-title" className="space-y-3">
          <h2 id="exam-list-title" className="text-lg font-semibold">
            Danh sách kỳ thi
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {states.map((state) => (
              <ExamCard key={state.exam.id} {...state} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function examState(exam: Exam, now: number) {
  const active = exam.attempts.find(
    (attempt) => attempt.status === "in_progress",
  );
  const canStart =
    now >= new Date(exam.opens_at).getTime() &&
    now < new Date(exam.closes_at).getTime();
  const result = exam.results_published_at ? exam.attempts[0] : undefined;
  const submitted = exam.attempts.some((attempt) => attempt.submitted_at);
  return { exam, active, canStart, result, submitted };
}

function ExamMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone: Tone;
}) {
  const style = toneStyle(tone);
  return (
    <Card className={`${style.surface} ${style.border} shadow-sm`}>
      <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <div
          className={`${style.icon} flex size-10 items-center justify-center rounded-xl`}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-text-secondary text-sm">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamCard({
  exam,
  active,
  canStart,
  result,
  submitted,
}: ReturnType<typeof examState>) {
  const tone: Tone = result
    ? "cyan"
    : active
      ? "sky"
      : submitted
        ? "amber"
        : canStart
          ? "amber"
          : "coral";
  const style = toneStyle(tone);

  return (
    <Card className={`${style.border} overflow-hidden shadow-sm`}>
      <CardHeader className={`${style.surface} ${style.border} border-b`}>
        <div className="flex items-start gap-3">
          <div
            className={`${style.icon} flex size-10 shrink-0 items-center justify-center rounded-xl`}
          >
            <GraduationCap className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle asChild className="text-lg leading-snug">
              <h3 className="break-words">{exam.title}</h3>
            </CardTitle>
            <p className="text-text-secondary mt-1 flex items-start gap-2 text-sm">
              <School className="mt-0.5 size-4 shrink-0" aria-hidden />
              {exam.class?.code} — {exam.class?.name}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-text-secondary">Thời gian mở</p>
            <p className="mt-1 flex items-start gap-2 font-semibold">
              <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {formatDateTime(exam.opens_at)} → {formatDateTime(exam.closes_at)}
              </span>
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Quy định</p>
            <p className="mt-1 font-semibold">
              {exam.duration_minutes} phút · Không copy/cut/paste
            </p>
          </div>
        </div>

        {result && (
          <div className="border-student-cyan-border bg-student-cyan-surface text-student-cyan-ink rounded-lg border p-3 text-sm font-semibold">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden />
              Điểm: {result.final_score_100}/100
            </p>
          </div>
        )}

        {result && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link href={`/student/exams/results/${result.id}`}>
              <FileCheck2 className="size-4" aria-hidden />
              Xem kết quả
            </Link>
          </Button>
        )}
        {active ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/student/exams/${exam.id}/attempt/${active.id}`}>
              <PlayCircle className="size-4" aria-hidden />
              Tiếp tục thi
            </Link>
          </Button>
        ) : submitted && !result ? (
          <div
            className="border-student-amber-border bg-student-amber-surface text-student-amber-ink flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            role="status"
          >
            <Clock3 className="size-4" aria-hidden />
            Đã nộp — chờ chấm
          </div>
        ) : !result ? (
          <ExamWaitingRoom
            deliveryId={exam.id}
            canStart={canStart}
            requiresMicrophone={exam.requires_microphone}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function toneStyle(tone: Tone) {
  return {
    sky: {
      surface: "bg-student-sky-surface",
      border: "border-student-sky-border",
      icon: "bg-primary text-white",
    },
    cyan: {
      surface: "bg-student-cyan-surface",
      border: "border-student-cyan-border",
      icon: "bg-student-cyan-ink text-white",
    },
    amber: {
      surface: "bg-student-amber-surface",
      border: "border-student-amber-border",
      icon: "bg-student-amber-ink text-white",
    },
    coral: {
      surface: "bg-student-coral-surface",
      border: "border-student-coral-border",
      icon: "bg-student-coral-ink text-white",
    },
  }[tone];
}
