import type { Metadata } from "next";
import {
  BookOpen,
  ClipboardPen,
  GraduationCap,
  MessageSquareText,
  School,
  Target,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RATING_FIELDS } from "@/features/evaluations/schema";
import { SKILL_FIELDS } from "@/features/assessments/schema";
import { getMyResults } from "@/features/student/server/result-queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatPercent, formatScore } from "@/lib/dates";
import {
  ASSESSMENT_TYPE_LABELS,
  EVALUATION_RATING_LABELS,
} from "@/lib/domain/labels";

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

  return (
    <>
      <PageHeader
        title="Kết quả"
        description="Chỉ hiện những gì giáo viên đã công bố cho bạn."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="results">Điểm ({results.length})</TabsTrigger>
          <TabsTrigger value="evaluations">
            Đánh giá ({evaluations.length})
          </TabsTrigger>
          <TabsTrigger value="progress">Tiến độ</TabsTrigger>
        </TabsList>

        {/* --- Điểm bài kiểm tra --- */}
        <TabsContent value="results" className="mt-4 space-y-4">
          {results.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={GraduationCap}
                  title="Chưa có kết quả nào được công bố"
                  description="Điểm chỉ hiện sau khi giáo viên công bố kết quả bài kiểm tra."
                />
              </CardContent>
            </Card>
          ) : (
            results.map((result) => (
              <Card key={result.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {result.assessment?.title ?? "Bài kiểm tra"}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {result.assessment
                          ? ASSESSMENT_TYPE_LABELS[result.assessment.type]
                          : "—"}{" "}
                        · {formatDate(result.assessment?.assessment_date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {result.classification && (
                        <StatusBadge label={result.classification} tone="info" />
                      )}
                      <span className="text-xl font-semibold">
                        {formatScore(result.overall_score)}
                        <span className="text-muted-foreground text-sm font-normal">
                          /{formatScore(result.assessment?.max_score)}
                        </span>
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {SKILL_FIELDS.map((skill) => (
                      <div
                        key={skill.name}
                        className="bg-muted/40 rounded-md border px-3 py-2"
                      >
                        <p className="text-muted-foreground text-xs">
                          {skill.label}
                        </p>
                        <p className="mt-0.5 font-medium">
                          {result[skill.name] === null
                            ? "—"
                            : formatScore(result[skill.name])}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.feedback && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">
                        Nhận xét của giáo viên
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {result.feedback}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* --- Đánh giá học tập + ghi chú được chia sẻ --- */}
        <TabsContent value="evaluations" className="mt-4 space-y-4">
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
                <Card key={evaluation.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Đánh giá {formatDate(evaluation.evaluation_date)}
                    </CardTitle>
                    {(evaluation.period_start || evaluation.period_end) && (
                      <p className="text-muted-foreground mt-1 text-xs">
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
                            className="bg-muted/50 rounded-md border px-2 py-1 text-xs"
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText className="size-4" aria-hidden />
                  Lời nhắn từ giáo viên ({notes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {notes.map((note) => (
                    <li key={note.id} className="px-5 py-3">
                      <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
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
        <TabsContent value="progress" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProgressStat
              icon={BookOpen}
              label="Bài học hoàn thành"
              value={`${progress?.completed_lessons ?? 0}/${progress?.total_lessons ?? 0}`}
            />
            <ProgressStat
              icon={Target}
              label="Tiến độ"
              value={formatPercent(progress?.progress_percent)}
            />
            <ProgressStat
              icon={GraduationCap}
              label="Điểm trung bình"
              value={
                progress?.avg_score === null || progress?.avg_score === undefined
                  ? "—"
                  : formatScore(progress.avg_score)
              }
            />
            <ProgressStat
              icon={ClipboardPen}
              label="Bài đã nộp"
              value={`${progress?.submitted_assignments ?? 0}/${progress?.total_assignments ?? 0}`}
            />
          </div>

          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-center gap-3">
              <span className="text-sm">Đủ điều kiện hoàn thành khóa học:</span>
              <StatusBadge
                label={progress?.is_completion_ready ? "Đủ điều kiện" : "Chưa đủ"}
                tone={progress?.is_completion_ready ? "success" : "neutral"}
              />
              <span className="text-muted-foreground text-xs">
                Điều kiện gồm chuyên cần, điểm và bài tập — do hệ thống tính từ dữ
                liệu thật.
              </span>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ProgressStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="mt-0.5 text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
