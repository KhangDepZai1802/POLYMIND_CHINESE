"use client";

import { useState, useTransition } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
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

type Feedback = { tone: "error" | "success"; message: string } | null;

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
  const item = items[Math.min(index, Math.max(items.length - 1, 0))];

  if (!item) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={CheckCircle2}
            title="Bạn đã ôn xong"
            description="Hiện không còn câu máy chấm nào cần làm lại."
          />
        </CardContent>
      </Card>
    );
  }

  const currentIndex = items.indexOf(item);
  const currentQueueId = item.queue_id;

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
        setFeedback({ tone: "error", message: result.success });
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
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Câu {currentIndex + 1}/{items.length}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
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
      </CardHeader>
      <CardContent className="space-y-5">
        {feedback && (
          <Alert
            variant={feedback.tone === "error" ? "destructive" : "default"}
          >
            <AlertDescription aria-live="polite">
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}
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
        />
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={pending || currentIndex === 0}
            onClick={() => move(currentIndex - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Câu trước
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={pending || currentIndex === items.length - 1}
            onClick={() => move(currentIndex + 1)}
          >
            Câu sau
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
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
  );
}

function hasAnswer(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (Array.isArray(payload.values)) return payload.values.length > 0;
  if (Array.isArray(payload.value)) return payload.value.length > 0;
  if (typeof payload.value === "string") return payload.value.trim().length > 0;
  return payload.value !== undefined && payload.value !== null;
}
