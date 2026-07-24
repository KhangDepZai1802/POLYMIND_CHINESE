"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  ListTodo,
  PlayCircle,
  RotateCcw,
  School,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudentExerciseOverview } from "@/features/assessment-results/server/overview";
import { startExerciseAction } from "@/features/exercises/server/actions";
import { formatDateTime } from "@/lib/dates";

type Tab = "todo" | "doing" | "submitted" | "graded" | "overdue";
type StudentTone = "sky" | "cyan" | "amber" | "coral";

const TAB_CONFIG: Array<{
  value: Tab;
  label: string;
  icon: LucideIcon;
  tone: StudentTone;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    value: "todo",
    label: "Cần làm",
    icon: ListTodo,
    tone: "amber",
    emptyTitle: "Không có bài đang chờ",
    emptyDescription: "Khi giáo viên giao bài mới, bài sẽ xuất hiện tại đây.",
  },
  {
    value: "doing",
    label: "Đang làm",
    icon: PlayCircle,
    tone: "sky",
    emptyTitle: "Chưa có bài đang làm",
    emptyDescription:
      "Bài đã bắt đầu nhưng chưa nộp sẽ được lưu trong nhóm này.",
  },
  {
    value: "submitted",
    label: "Đã nộp",
    icon: Clock3,
    tone: "cyan",
    emptyTitle: "Chưa có bài chờ chấm",
    emptyDescription: "Bài vừa nộp sẽ ở đây cho đến khi có kết quả.",
  },
  {
    value: "graded",
    label: "Đã chấm",
    icon: CheckCircle2,
    tone: "cyan",
    emptyTitle: "Chưa có kết quả mới",
    emptyDescription: "Kết quả được giáo viên công bố sẽ xuất hiện tại đây.",
  },
  {
    value: "overdue",
    label: "Quá hạn",
    icon: CircleAlert,
    tone: "coral",
    emptyTitle: "Không có bài quá hạn",
    emptyDescription:
      "Tuyệt vời, hiện không có bài nào nằm trong nhóm quá hạn.",
  },
];

export function StudentExerciseList({
  deliveries,
  initialTab = "todo",
}: {
  deliveries: StudentExerciseOverview[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [now] = useState(() => Date.now());
  const byTab = Object.fromEntries(
    TAB_CONFIG.map(({ value }) => [
      value,
      deliveries.filter((delivery) => matchesTab(delivery, value, now)),
    ]),
  ) as Record<Tab, StudentExerciseOverview[]>;

  const overview = [
    {
      label: "Cần ưu tiên",
      value: byTab.todo.length + byTab.overdue.length,
      detail: `${byTab.todo.length} cần làm · ${byTab.overdue.length} quá hạn`,
      icon: ListTodo,
      tone: "amber" as const,
    },
    {
      label: "Đang thực hiện",
      value: byTab.doing.length,
      detail: "Câu trả lời được tự động lưu",
      icon: PlayCircle,
      tone: "sky" as const,
    },
    {
      label: "Đang chờ chấm",
      value: byTab.submitted.length,
      detail: "Đã nộp thành công",
      icon: Clock3,
      tone: "cyan" as const,
    },
    {
      label: "Đã có kết quả",
      value: byTab.graded.length,
      detail: "Có thể xem lại bài làm",
      icon: FileCheck2,
      tone: "coral" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="exercise-overview-title" className="space-y-3">
        <div>
          <h2 id="exercise-overview-title" className="text-lg font-semibold">
            Tổng quan bài tập
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Bắt đầu từ nhóm cần ưu tiên, tiếp tục bài dở hoặc xem lại kết quả đã
            công bố.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {overview.map((item) => (
            <OverviewCard key={item.label} {...item} />
          ))}
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        activationMode="manual"
      >
        <nav
          aria-label="Trạng thái bài tập"
          tabIndex={0}
          className="border-student-sky-border bg-student-sky-surface focus-visible:ring-ring overflow-x-auto rounded-xl border p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <TabsList className="min-w-max bg-transparent p-0">
            {TAB_CONFIG.map((item) => (
              <ExerciseTab
                key={item.value}
                value={item.value}
                label={item.label}
                icon={item.icon}
                count={byTab[item.value].length}
              />
            ))}
          </TabsList>
        </nav>

        {TAB_CONFIG.map((item) => (
          <TabsContent key={item.value} value={item.value} className="mt-4">
            {byTab[item.value].length === 0 ? (
              <Card className="border-student-sky-border">
                <EmptyState
                  icon={item.icon}
                  title={item.emptyTitle}
                  description={item.emptyDescription}
                />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {byTab[item.value].map((delivery) => (
                  <ExerciseCard
                    key={delivery.id}
                    delivery={delivery}
                    tone={item.tone}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function matchesTab(delivery: StudentExerciseOverview, tab: Tab, now: number) {
  const active = delivery.attempts.some((attempt) =>
    ["in_progress", "returned_for_revision"].includes(attempt.status),
  );
  const published = delivery.attempts.some(
    (attempt) => attempt.results_published_at,
  );
  const submitted = delivery.attempts.some(
    (attempt) => attempt.submitted_at && !attempt.results_published_at,
  );
  const overdue =
    now > new Date(delivery.due_at).getTime() && !submitted && !published;

  return tab === "doing"
    ? active
    : tab === "graded"
      ? published
      : tab === "submitted"
        ? submitted
        : tab === "overdue"
          ? overdue
          : !active && !submitted && !published && !overdue;
}

function OverviewCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: StudentTone;
}) {
  const styles = toneStyles(tone);
  return (
    <Card className={`${styles.border} ${styles.surface} shadow-sm`}>
      <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <div
          className={`${styles.icon} flex size-10 shrink-0 items-center justify-center rounded-xl`}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-text-secondary text-sm">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExerciseTab({
  value,
  label,
  icon: Icon,
  count,
}: {
  value: Tab;
  label: string;
  icon: LucideIcon;
  count: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
    >
      <Icon className="size-4" aria-hidden />
      {label}
      <span className="rounded-full border border-current px-1.5 text-sm font-semibold">
        {count}
      </span>
    </TabsTrigger>
  );
}

function ExerciseCard({
  delivery,
  tone,
}: {
  delivery: StudentExerciseOverview;
  tone: StudentTone;
}) {
  const active = delivery.attempts.find((attempt) =>
    ["in_progress", "returned_for_revision"].includes(attempt.status),
  );
  const published = delivery.attempts.find(
    (attempt) => attempt.results_published_at,
  );
  const submitted = delivery.attempts.find((attempt) => attempt.submitted_at);
  const styles = toneStyles(tone);

  return (
    <Card className={`${styles.border} overflow-hidden shadow-sm`}>
      <CardHeader className={`${styles.surface} border-b ${styles.border}`}>
        <div className="flex items-start gap-3">
          <div
            className={`${styles.icon} flex size-10 shrink-0 items-center justify-center rounded-xl`}
          >
            <BookOpenCheck className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle asChild className="text-lg leading-snug">
              <h2 className="break-words">{delivery.title}</h2>
            </CardTitle>
            <p className="text-text-secondary mt-1 flex items-start gap-2 text-sm">
              <School className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {delivery.class.code} — {delivery.class.name}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-text-secondary">Hạn nộp</p>
            <p className="mt-1 flex items-start gap-2 font-semibold">
              <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {formatDateTime(delivery.due_at)}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Thang điểm</p>
            <p className="mt-1 font-semibold">{delivery.max_score} điểm</p>
          </div>
        </div>

        {published && (
          <div className="border-student-cyan-border bg-student-cyan-surface text-student-cyan-ink rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4" aria-hidden />
              Điểm: {published.final_score}/{delivery.max_score}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {published ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href={`/student/exercises/results/${published.id}`}>
                <FileCheck2 className="size-4" aria-hidden />
                Xem kết quả
              </Link>
            </Button>
          ) : active ? (
            <Button asChild className="w-full sm:w-auto">
              <Link
                href={`/student/exercises/${delivery.id}/attempt/${active.id}`}
              >
                <RotateCcw className="size-4" aria-hidden />
                Tiếp tục làm
              </Link>
            </Button>
          ) : submitted ? (
            <div
              role="status"
              className="border-student-cyan-border bg-student-cyan-surface text-student-cyan-ink flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Clock3 className="size-4 shrink-0" aria-hidden />
              Đã nộp — chờ chấm
            </div>
          ) : (
            <form action={startExerciseAction} className="w-full sm:w-auto">
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <SubmitButton
                pendingText="Đang mở bài tập…"
                className="w-full sm:w-auto"
              >
                <PlayCircle className="size-4" aria-hidden />
                Bắt đầu làm
              </SubmitButton>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function toneStyles(tone: StudentTone) {
  return {
    sky: {
      surface: "bg-student-sky-surface",
      border: "border-student-sky-border",
      icon: "bg-primary text-primary-foreground",
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
