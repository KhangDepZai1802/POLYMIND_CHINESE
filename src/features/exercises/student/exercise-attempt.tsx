"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MicrophoneCheck } from "@/components/shared/microphone-check";
import {
  deleteExerciseSpeakingAnswer,
  saveExerciseAnswer,
  submitExerciseAttempt,
  uploadExerciseSpeakingAnswer,
} from "@/features/exercises/server/actions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import { SpeakingRecorder } from "@/features/question-builder/renderers/speaking-recorder";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/shared/confirmation-provider";
import type { QuestionType } from "@/features/question-builder/domain/questions";

type Item = {
  id: string;
  order_index: number;
  points: number;
  required: boolean;
  answer: unknown;
  question: {
    id: string;
    type: QuestionType;
    prompt_text: string;
    prompt_content: Record<string, unknown>;
    options: Array<{ option_key: string; content: string }>;
  };
};
type Payload = {
  attempt: {
    id: string;
    status: string;
    started_at: string;
    attempt_no: number;
  };
  delivery: {
    id: string;
    title: string;
    instructions: string | null;
    due_at: string;
    max_score: number;
  };
  items: Item[];
};
/** Bản ghi Nói đã nộp: server ký signed URL vào answer.audio_url. */
function audioUrlOf(answer: unknown): string | null {
  if (answer && typeof answer === "object" && "audio_url" in answer) {
    const url = (answer as { audio_url?: unknown }).audio_url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

export function ExerciseAttempt({ payload }: { payload: Payload }) {
  const confirm = useConfirmation();
  const router = useRouter();
  // Câu Nói tự lưu qua recorder (RPC riêng) — không đưa vào state chung để
  // vòng lưu-khi-nộp không ghi đè answer_payload đã có audio_path.
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(
      payload.items
        .filter((item) => item.question.type !== "speaking")
        .map((item) => [item.id, item.answer ?? {}]),
    ),
  );
  const [saved, setSaved] = useState("Đã tải câu trả lời đã lưu");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(
    () => () => Object.values(timers.current).forEach(clearTimeout),
    [],
  );
  const change = (itemId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [itemId]: value }));
    setSaved("Đang lưu…");
    clearTimeout(timers.current[itemId]);
    timers.current[itemId] = setTimeout(async () => {
      const result = await saveExerciseAnswer(
        payload.attempt.id,
        itemId,
        value,
      );
      if (result.ok) {
        setSaved(
          `Đã lưu lúc ${new Date(result.savedAt!).toLocaleTimeString("vi-VN")}`,
        );
        setError(undefined);
      } else {
        setSaved("Chưa lưu");
        setError(result.error);
      }
    }, 1000);
  };
  const submit = async () => {
    if (isSubmitting) return;
    const accepted = await confirm({
      title: "Nộp bài ngay?",
      description: "Bạn không thể sửa lượt làm này sau khi nộp.",
      confirmLabel: "Nộp bài",
    });
    if (!accepted) return;
    setIsSubmitting(true);
    setError(undefined);
    setSaved("Đang lưu lần cuối và nộp bài…");
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};

    try {
      const saveResults = await Promise.all(
        Object.entries(answers).map(([itemId, value]) =>
          saveExerciseAnswer(payload.attempt.id, itemId, value),
        ),
      );
      const failedSave = saveResults.find((result) => !result.ok);
      if (failedSave) {
        setSaved("Chưa nộp — có câu trả lời chưa lưu được");
        setError(failedSave.error ?? "Không lưu được câu trả lời cuối cùng.");
        setIsSubmitting(false);
        return;
      }

      const result = await submitExerciseAttempt(payload.attempt.id);
      if (!result.ok) {
        setSaved("Chưa nộp bài");
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      setSaved("Đã nộp bài thành công");
      toast.success("Đã nộp bài thành công.");
      window.dispatchEvent(new Event("navstart"));
      router.replace("/student/exercises?tab=submitted");
    } catch {
      setSaved("Chưa nộp bài");
      setError(
        "Mất kết nối khi nộp bài. Câu trả lời vẫn được giữ để bạn thử lại.",
      );
      setIsSubmitting(false);
    }
  };
  const requiresMicrophone = payload.items.some(
    (item) => item.question.type === "speaking",
  );
  const submitContent = isSubmitting ? (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Đang nộp bài…
    </>
  ) : (
    "Nộp bài"
  );
  return (
    <div className="space-y-6" aria-busy={isSubmitting}>
      <div className="bg-background/95 sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-sm backdrop-blur">
        <div>
          <p className="font-semibold">{payload.delivery.title}</p>
          <p className="text-muted-foreground text-xs">{saved}</p>
        </div>
        <Button onClick={submit} disabled={isSubmitting}>
          {submitContent}
        </Button>
      </div>
      {error && (
        <p className="text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      {requiresMicrophone && <MicrophoneCheck />}
      <div className="space-y-6">
        {payload.items.map((item, index) => (
          <section key={item.id} className="bg-card rounded-xl border p-5">
            <p className="mb-4 text-sm font-semibold">
              Câu {index + 1} · {item.points} điểm
            </p>
            {item.question.type === "speaking" ? (
              <div className="space-y-4">
                <p className="text-base font-medium whitespace-pre-wrap">
                  {item.question.prompt_text}
                </p>
                <SpeakingRecorder
                  existingUrl={audioUrlOf(item.answer)}
                  onUpload={(blob, durationMs) => {
                    const fd = new FormData();
                    fd.set("audio", blob, "speaking");
                    fd.set("duration_ms", String(durationMs));
                    return uploadExerciseSpeakingAnswer(
                      payload.attempt.id,
                      item.id,
                      fd,
                    );
                  }}
                  onDelete={() =>
                    deleteExerciseSpeakingAnswer(payload.attempt.id, item.id)
                  }
                />
              </div>
            ) : (
              <QuestionRenderer
                type={item.question.type}
                prompt={item.question.prompt_text}
                promptContent={item.question.prompt_content}
                options={item.question.options}
                value={answers[item.id]}
                onChange={(value) => change(item.id, value)}
              />
            )}
          </section>
        ))}
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={submit}
        disabled={isSubmitting}
      >
        {submitContent}
      </Button>
    </div>
  );
}
