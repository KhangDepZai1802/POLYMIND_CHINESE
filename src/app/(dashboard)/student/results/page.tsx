import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  ClipboardPen,
  GraduationCap,
  MessageSquareText,
  School,
  Target,
  TrendingUp,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentStatCard } from "@/components/shared/student-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RATING_FIELDS } from "@/features/evaluations/schema";
import { getMyResults } from "@/features/student/server/result-queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatPercent, formatScore } from "@/lib/dates";
import { EVALUATION_RATING_LABELS } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Kết quả" };

const TABS = ["results", "evaluations", "progress"] as const;
type Tab = (typeof TABS)[number];

export default async function StudentResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("student");
  const { tab } = await searchParams;
  const defaultTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "results";

  const enrollment = await getMyEnrollment();

  if (!enrollment?.class) {
    return (
      <>
        <PageHeader
          title="Kết quả"
          description="Điểm, đánh giá và tiến độ đã công bố."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Kết quả học tập sẽ hiện ở đây sau khi bạn được xếp lớp."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const { results, evaluations, notes, progress } = await getMyResults(
    enrollment.id,
  );

  const progressPercent = toPercent(progress?.progress_percent);

  return (
    <>
      <PageHeader
        title="Kết quả"
        description="Chỉ hiện những gì giáo viên đã công bố cho bạn."
      />

      <section aria-labelledby="m25-summary" className="space-y-4">
        <h2 id="m25-summary" className="text-base font-semibold">
          Tổng quan học tập
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StudentStatCard
            icon={GraduationCap}
            tone="sky"
            label="Điểm trung bình"
            value={formatAvgScore(progress?.avg_score)}
            hint="Các bài đã công bố điểm, quy về thang 100."
          />
          <StudentStatCard
            icon={Target}
            tone="cyan"
            label="Tiến độ khóa học"
            value={formatPercent(progress?.progress_percent)}
            hint="Tổng hợp từ bài học, chuyên cần, bài đã nộp và điểm."
          />
          <StudentStatCard
            icon={CalendarCheck}
            tone="amber"
            label="Chuyên cần"
            value={formatPercent(progress?.attendance_rate)}
            hint="Tỉ lệ buổi học bạn có mặt."
          />
          <StudentStatCard
            icon={ClipboardPen}
            tone="coral"
            label="Bài đã nộp"
            value={`${progress?.submitted_exercises ?? 0}/${progress?.total_exercises ?? 0}`}
            hint="Số bài tập bạn đã nộp trên tổng số được giao."
          />
        </div>
      </section>

      <Tabs defaultValue={defaultTab} className="mt-6 space-y-4">
        <nav
          aria-label="Nhóm kết quả"
          tabIndex={0}
          className="border-student-sky-border bg-student-sky-surface focus-visible:ring-ring overflow-x-auto rounded-xl border p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <TabsList className="min-w-max bg-transparent p-0">
            <TabsTrigger
              value="results"
              className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <GraduationCap className="size-4" aria-hidden />
              Điểm
              <span className="rounded-full border border-current px-1.5 text-sm font-semibold">
                {results.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="evaluations"
              className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <ClipboardPen className="size-4" aria-hidden />
              Đánh giá
              <span className="rounded-full border border-current px-1.5 text-sm font-semibold">
                {evaluations.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <TrendingUp className="size-4" aria-hidden />
              Tiến độ
            </TabsTrigger>
          </TabsList>
        </nav>

        {/* --- Điểm bài kiểm tra --- */}
        <TabsContent value="results" className="space-y-4">
          <h2 className="text-base font-semibold">Điểm đã công bố</h2>
          {results.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={GraduationCap}
                  title="Chưa có kết quả nào được công bố"
                  description="Điểm chỉ hiện sau khi giáo viên công bố kết quả bài kiểm tra."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/student/exercises">Xem bài tập được giao</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            results.map((result) => {
              const ratio = toRatio(result.score, result.maxScore);

              return (
                <Card key={result.id} className="shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle asChild>
                          <h3 className="text-base">{result.title}</h3>
                        </CardTitle>
                        <p className="text-text-secondary mt-1 text-sm">
                          {result.kind} · Công bố {formatDate(result.publishedAt)}
                        </p>
                      </div>
                      <span className="text-xl font-semibold">
                        {formatScore(result.score)}
                        <span className="text-text-secondary text-sm font-normal">
                          /{formatScore(result.maxScore)}
                        </span>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {ratio !== null && (
                      <div
                        role="progressbar"
                        aria-label={`Tỉ lệ điểm của ${result.title}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={ratio}
                        aria-valuetext={`${formatScore(result.score)} trên ${formatScore(result.maxScore)} điểm`}
                        className="bg-surface-sunken h-2 overflow-hidden rounded-full"
                      >
                        <div
                          className="bg-student-sky-ink h-full rounded-full"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    )}
                    <Link
                      href={result.href}
                      className="text-primary focus-visible:ring-ring inline-flex rounded-md text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Xem chi tiết điểm, feedback và đáp án
                    </Link>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* --- Đánh giá học tập + ghi chú được chia sẻ --- */}
        <TabsContent value="evaluations" className="space-y-4">
          <h2 className="text-base font-semibold">Đánh giá học tập</h2>
          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={ClipboardPen}
                  title="Chưa có đánh giá nào"
                  description="Bản đánh giá học tập sẽ hiện sau khi giáo viên gửi cho bạn."
                />
              </CardContent>
            </Card>
          ) : (
            evaluations.map((evaluation) => {
              const ratings = RATING_FIELDS.filter(
                (field) => evaluation[field.name],
              );

              return (
                <Card key={evaluation.id} className="shadow-sm">
                  <CardHeader>
                    <CardTitle asChild>
                      <h3 className="text-base">
                        Đánh giá {formatDate(evaluation.evaluation_date)}
                      </h3>
                    </CardTitle>
                    {(evaluation.period_start || evaluation.period_end) && (
                      <p className="text-text-secondary mt-1 text-sm">
                        Kỳ {formatDate(evaluation.period_start)} –{" "}
                        {formatDate(evaluation.period_end)}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {ratings.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ratings.map((field) => (
                          <span
                            key={field.name}
                            className="border-student-sky-border bg-student-sky-surface text-student-sky-ink rounded-md border px-2.5 py-1 text-sm"
                          >
                            {field.label}:{" "}
                            <strong>
                              {
                                EVALUATION_RATING_LABELS[
                                  evaluation[field.name]!
                                ]
                              }
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <TextBlock label="Điểm mạnh" value={evaluation.strengths} />
                    <TextBlock
                      label="Cần cải thiện"
                      value={evaluation.areas_for_improvement}
                    />
                    <TextBlock
                      label="Kế hoạch hành động"
                      value={evaluation.action_plan}
                    />
                    <TextBlock
                      label="Nhận xét"
                      value={evaluation.teacher_comment}
                    />
                  </CardContent>
                </Card>
              );
            })
          )}

          {notes.length > 0 && (
            <Card className="gap-0 overflow-hidden py-0 shadow-sm">
              <CardHeader className="border-b px-5 py-5 sm:px-6">
                <CardTitle asChild>
                  <h2 className="flex items-center gap-2 text-base">
                    <span className="bg-student-amber-surface text-student-amber-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <MessageSquareText className="size-4" aria-hidden />
                    </span>
                    Lời nhắn từ giáo viên ({notes.length})
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {notes.map((note) => (
                    <li key={note.id} className="px-5 py-4 sm:px-6">
                      <p className="text-sm leading-6 whitespace-pre-wrap">
                        {note.body}
                      </p>
                      <p className="text-text-secondary mt-1 text-sm">
                        {formatDate(note.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Tiến độ --- */}
        <TabsContent value="progress" className="space-y-4">
          <h2 className="text-base font-semibold">Chặng đường khóa học</h2>

          <Card className="border-student-cyan-border bg-student-cyan-surface shadow-none">
            <CardContent className="px-5 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Tiến độ khóa học</p>
                <p className="text-student-cyan-ink text-xl font-bold">
                  {formatPercent(progress?.progress_percent)}
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Tiến độ khóa học"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-valuetext={`${formatPercent(progress?.progress_percent)} tiến độ khóa học`}
                className="bg-surface-sunken mt-3 h-2.5 overflow-hidden rounded-full"
              >
                <div
                  className="bg-student-cyan-ink h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-text-secondary mt-2 text-sm leading-6">
                Con số này tổng hợp bốn phần: bài học đã hoàn thành, chuyên cần,
                bài tập đã nộp và điểm trung bình — nên nó không bằng riêng tỉ lệ
                bài học.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <StudentStatCard
              icon={BookOpen}
              tone="sky"
              label="Bài học hoàn thành"
              value={`${progress?.completed_lessons ?? 0}/${progress?.total_lessons ?? 0}`}
              hint="Số buổi đã học trên tổng số buổi của khóa."
            />
            <StudentStatCard
              icon={CalendarCheck}
              tone="amber"
              label="Chuyên cần"
              value={formatPercent(progress?.attendance_rate)}
              hint="Tỉ lệ buổi học bạn có mặt."
            />
          </div>

          <Card className="shadow-sm">
            <CardContent className="space-y-2 px-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  Đủ điều kiện hoàn thành khóa học:
                </span>
                <StatusBadge
                  label={progress?.is_completion_ready ? "Đủ điều kiện" : "Chưa đủ"}
                  tone={progress?.is_completion_ready ? "success" : "neutral"}
                />
              </div>
              <p className="text-text-secondary text-sm leading-6">
                Điều kiện gồm chuyên cần, điểm và bài tập — do hệ thống tính từ dữ
                liệu thật.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * `avg_score` của `v_enrollment_assessment_progress` **đã được quy về thang
 * 100** (`final_score / max_score * 100` cho bài tập, `final_score_100` cho kỳ
 * thi). In số trần sẽ gây hiểu nhầm vì ngay bên dưới là các thẻ điểm dạng
 * `8/10`. Nên luôn kèm thang.
 */
function formatAvgScore(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${formatScore(n)}/100`;
}

/** Phần trăm đã kẹp về 0–100 để đưa vào `aria-valuenow` và bề rộng thanh. */
function toPercent(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Tỉ lệ điểm/điểm tối đa. Trả `null` khi không có thang điểm để so. */
function toRatio(
  score: number | string | null | undefined,
  maxScore: number | string | null | undefined,
): number | null {
  if (score === null || score === undefined || score === "") return null;
  const s = typeof score === "string" ? Number(score) : score;
  const m = typeof maxScore === "string" ? Number(maxScore) : maxScore;
  if (Number.isNaN(s) || m === null || m === undefined || Number.isNaN(m)) {
    return null;
  }
  if (m <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((s / m) * 100)));
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-text-secondary text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
