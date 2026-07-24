"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Layers,
  Loader2,
  RefreshCcw,
  Repeat2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QUESTION_TYPE_LABELS } from "@/features/question-builder/domain/questions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import type { WrongAnswerReviewItem } from "@/features/wrong-answer-review/schema";
import { submitWrongAnswerReviewAction } from "@/features/wrong-answer-review/server/actions";
import { formatDate } from "@/lib/dates";

/**
 * `retry` là "chưa đúng, làm lại" — cố ý tách khỏi `error` (lỗi hệ thống) để
 * phản hồi học tập không bị trình bày như sự cố. Chữ của thông báo không đổi.
 */
type FeedbackTone = "error" | "retry" | "success";
type Feedback = { tone: FeedbackTone; message: string } | null;
type StudentTone = "sky" | "cyan" | "amber" | "coral";

export function WrongAnswerReview({
  initialItems,
}: {
  initialItems: WrongAnswerReviewItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<unknown>();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  // Mốc để đo tiến độ phiên ôn; giữ nguyên kể cả khi `items` rút ngắn dần.
  const [startingCount] = useState(() => initialItems.length);
  const item = items[Math.min(index, Math.max(items.length - 1, 0))];

  const resolved = Math.max(startingCount - items.length, 0);
  const progress =
    startingCount === 0 ? 100 : Math.round((resolved / startingCount) * 100);

  if (!item) {
    return (
      <div className="space-y-6">
        <ReviewProgress
          resolved={resolved}
          startingCount={startingCount}
          progress={progress}
        />
        <Card className="border-student-cyan-border bg-student-cyan-surface">
          <CardContent className="p-0">
            <EmptyState
              icon={CheckCircle2}
              title="Bạn đã ôn xong"
              description="Hiện không còn câu máy chấm nào cần làm lại. Câu mới sẽ tự vào đây khi bạn làm sai ở bài tập hoặc bài thi."
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/student">
              <Sparkles className="size-4" aria-hidden />
              Về Tổng quan
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/student/exercises">
              <FileCheck2 className="size-4" aria-hidden />
              Sang Bài tập
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentIndex = items.indexOf(item);
  const currentQueueId = item.queue_id;

  const overview = [
    {
      label: "Còn cần ôn",
      value: items.length,
      detail: "Làm đúng thì câu rời danh sách",
      icon: Layers,
      tone: "amber" as const,
    },
    {
      label: "Từ Bài tập",
      value: items.filter((entry) => entry.source_kind === "exercise").length,
      detail: "Câu sai trong bài tập về nhà",
      icon: FileCheck2,
      tone: "sky" as const,
    },
    {
      label: "Từ Bài thi",
      value: items.filter((entry) => entry.source_kind === "exam").length,
      detail: "Câu sai trong kiểm tra, thi",
      icon: BrainCircuit,
      tone: "cyan" as const,
    },
    {
      label: "Sai nhiều lần",
      value: items.filter((entry) => entry.wrong_count > 1).length,
      detail: "Nhóm nên ưu tiên ôn kỹ",
      icon: Repeat2,
      tone: "coral" as const,
    },
  ];

  function move(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= items.length) return;
    setIndex(nextIndex);
    setAnswer(undefined);
    setFeedback(null);
  }

  function submit() {
    if (!hasAnswer(answer)) {
      setFeedback({
        tone: "error",
        message: "Hãy nhập hoặc chọn câu trả lời trước.",
      });
      return;
    }

    startTransition(async () => {
      const result = await submitWrongAnswerReviewAction({
        queueId: currentQueueId,
        answerPayload: answer,
      });
      if ("error" in result) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }

      if (!result.isCorrect) {
        setAnswer(undefined);
        setFeedback({ tone: "retry", message: result.success });
        toast.error("Chưa đúng, thử lại nhé.");
        return;
      }

      toast.success(result.success);
      setFeedback({ tone: "success", message: result.success });
      const remaining = items.filter(
        (candidate) => candidate.queue_id !== currentQueueId,
      );
      setItems(remaining);
      setIndex(Math.min(currentIndex, Math.max(remaining.length - 1, 0)));
      setAnswer(undefined);
    });
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="review-overview-title" className="space-y-3">
        <div>
          <h2 id="review-overview-title" className="text-lg font-semibold">
            Tổng quan câu cần ôn
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Mỗi câu bạn làm đúng sẽ rời khỏi danh sách. Ưu tiên nhóm đã sai
            nhiều lần trước.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {overview.map((entry) => (
            <OverviewCard key={entry.label} {...entry} />
          ))}
        </div>
        <ReviewProgress
          resolved={resolved}
          startingCount={startingCount}
          progress={progress}
        />
      </section>

      <Card className="border-student-sky-border overflow-hidden shadow-sm">
        <CardHeader className="bg-student-sky-surface border-student-sky-border gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle asChild className="text-lg leading-snug">
                <h2>
                  Câu {currentIndex + 1}/{items.length}
                </h2>
              </CardTitle>
              <p className="text-text-secondary mt-1 text-sm">
                {QUESTION_TYPE_LABELS[item.question_type]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  item.source_kind === "exercise" ? "Từ Bài tập" : "Từ Bài thi"
                }
                tone="info"
              />
              <StatusBadge
                label={`Đã sai ${item.wrong_count} lần`}
                tone="warning"
              />
            </div>
          </div>
          <p className="text-text-secondary flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            Sai gần nhất ngày {formatDate(item.last_seen_at)}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/*
            Vùng thông báo phải tồn tại sẵn trong DOM. Nếu chỉ render khi có
            `feedback`, vùng live sinh ra cùng lúc với nội dung và trình đọc
            màn hình thường bỏ qua kết quả chấm.
          */}
          <div aria-live="polite" aria-atomic="true">
            {feedback && <FeedbackNotice feedback={feedback} />}
          </div>
          <QuestionRenderer
            type={item.question_type}
            prompt={item.prompt}
            promptContent={item.prompt_content}
            options={item.options}
            value={answer}
            onChange={(value) => {
              setAnswer(value);
              setFeedback(null);
            }}
            disabled={pending}
            audioPlayback="student-source"
          />
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={pending || currentIndex === 0}
              onClick={() => move(currentIndex - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Câu trước
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={pending || currentIndex === items.length - 1}
              onClick={() => move(currentIndex + 1)}
            >
              Câu sau
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={submit}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <BrainCircuit className="size-4" aria-hidden />
            )}
            {pending ? "Đang chấm và lưu…" : "Kiểm tra đáp án"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ReviewProgress({
  resolved,
  startingCount,
  progress,
}: {
  resolved: number;
  startingCount: number;
  progress: number;
}) {
  if (startingCount === 0) return null;

  return (
    <div className="border-student-cyan-border bg-student-cyan-surface rounded-xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Tiến độ phiên ôn này</p>
        <p className="text-student-cyan-ink text-sm font-semibold">
          {resolved}/{startingCount} câu đã ôn xong
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ ôn câu sai"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${resolved} trên ${startingCount} câu đã ôn xong`}
        className="bg-surface-sunken mt-2 h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-student-cyan-ink h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackNotice({ feedback }: { feedback: NonNullable<Feedback> }) {
  if (feedback.tone === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{feedback.message}</AlertDescription>
      </Alert>
    );
  }

  const styles =
    feedback.tone === "success"
      ? {
          box: "border-student-cyan-border bg-student-cyan-surface text-student-cyan-ink",
          icon: CheckCircle2,
        }
      : {
          box: "border-student-amber-border bg-student-amber-surface text-student-amber-ink",
          icon: RefreshCcw,
        };
  const Icon = styles.icon;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm font-medium ${styles.box}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{feedback.message}</span>
    </div>
  );
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

function hasAnswer(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (Array.isArray(payload.values)) return payload.values.length > 0;
  if (Array.isArray(payload.value)) return payload.value.length > 0;
  if (typeof payload.value === "string") return payload.value.trim().length > 0;
  return payload.value !== undefined && payload.value !== null;
}
