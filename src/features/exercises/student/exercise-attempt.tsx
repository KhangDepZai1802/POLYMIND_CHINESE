"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CircleGauge,
  ClipboardCheck,
  FileText,
  Loader2,
  Mic2,
} from "lucide-react";
import { toast } from "sonner";

import { MicrophoneCheck } from "@/components/shared/microphone-check";
import {
  createExerciseSpeakingUploadUrl,
  deleteExerciseSpeakingAnswer,
  saveExerciseAnswer,
  submitExerciseAttempt,
  uploadExerciseSpeakingAnswer,
} from "@/features/exercises/server/actions";
import { uploadSpeakingAnswerBlob } from "@/features/assessment-results/client/speaking-upload";
import { formatDateTime, formatTime } from "@/lib/dates";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import {
  SpeakingRecorder,
  type SpeakingRecorderStatus,
} from "@/features/question-builder/renderers/speaking-recorder";
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
  const [speakingStatuses, setSpeakingStatuses] = useState<
    Record<string, SpeakingRecorderStatus>
  >({});
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
          `Đã lưu lúc ${formatTime(result.savedAt!)}`,
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
    const unfinishedRecording = Object.values(speakingStatuses).some((status) =>
      ["recording", "recorded", "uploading", "upload_error"].includes(status),
    );
    if (unfinishedRecording) {
      setSaved("Chưa thể nộp — bản ghi âm chưa được lưu");
      setError(
        "Hãy dừng thu và đợi đến khi câu Nói hiện “Đã nộp bản ghi” rồi nộp toàn bài.",
      );
      return;
    }
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
  const hasPendingRecording = Object.values(speakingStatuses).some((status) =>
    ["recording", "recorded", "uploading", "upload_error"].includes(status),
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
    <div
      className="mx-auto w-full max-w-5xl space-y-6"
      aria-busy={isSubmitting}
    >
      <section
        aria-labelledby="exercise-attempt-title"
        className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl p-5 shadow-sm sm:p-7"
      >
        <div
          className="bg-brand-orange absolute -top-8 -right-8 size-28 rounded-full"
          aria-hidden
        />
        <div
          className="bg-brand-red absolute right-20 bottom-5 size-4 rotate-12 rounded-sm"
          aria-hidden
        />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="size-4" aria-hidden />
            Bài tập đang làm
          </p>
          <h1
            id="exercise-attempt-title"
            className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {payload.delivery.title}
          </h1>
          {payload.delivery.instructions && (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap sm:text-base">
              {payload.delivery.instructions}
            </p>
          )}
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <AttemptMeta
              icon={CalendarClock}
              label="Hạn nộp"
              value={formatDateTime(payload.delivery.due_at)}
            />
            <AttemptMeta
              icon={CircleGauge}
              label="Thang điểm"
              value={`${payload.delivery.max_score} điểm`}
            />
            <AttemptMeta
              icon={FileText}
              label="Số câu"
              value={`${payload.items.length} câu`}
            />
          </div>
        </div>
      </section>

      <div className="border-student-sky-border bg-student-sky-surface sticky top-2 z-20 flex flex-col gap-3 rounded-xl border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">Tiến trình làm bài</p>
          <p
            className="text-student-sky-ink text-sm"
            role="status"
            aria-live="polite"
          >
            {saved}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={submit}
          disabled={isSubmitting || hasPendingRecording}
        >
          {submitContent}
        </Button>
      </div>
      {error && (
        <p
          className="border-destructive bg-background text-destructive rounded-lg border p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
      {requiresMicrophone && (
        <section aria-label="Chuẩn bị micro" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="bg-student-cyan-ink flex size-9 items-center justify-center rounded-lg text-white">
              <Mic2 className="size-4" aria-hidden />
            </div>
            <p className="font-semibold">Chuẩn bị cho câu Nói</p>
          </div>
          <MicrophoneCheck />
        </section>
      )}
      <div className="space-y-6">
        {payload.items.map((item, index) => {
          const tone = questionTone(index);
          const headingId = `exercise-question-${item.id}`;
          return (
            <section
              key={item.id}
              aria-labelledby={headingId}
              className={`${tone.border} bg-card overflow-hidden rounded-xl border shadow-sm`}
            >
              <div
                className={`${tone.surface} ${tone.border} flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5`}
              >
                <h2 id={headingId} className="font-semibold">
                  Câu {index + 1}
                </h2>
                <p className={`${tone.ink} text-sm font-semibold`}>
                  {item.points} điểm{item.required ? " · Bắt buộc" : ""}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                {item.question.type === "speaking" ? (
                  <div className="space-y-4">
                    <p className="text-base font-medium whitespace-pre-wrap">
                      {item.question.prompt_text}
                    </p>
                    <SpeakingRecorder
                      existingUrl={audioUrlOf(item.answer)}
                      onStatusChange={(status) =>
                        setSpeakingStatuses((current) =>
                          current[item.id] === status
                            ? current
                            : { ...current, [item.id]: status },
                        )
                      }
                      onUpload={(blob, durationMs) =>
                        uploadSpeakingAnswerBlob({
                          blob,
                          durationMs,
                          createTicket: (input) =>
                            createExerciseSpeakingUploadUrl(
                              payload.attempt.id,
                              item.id,
                              input,
                            ),
                          attach: (input) =>
                            uploadExerciseSpeakingAnswer(
                              payload.attempt.id,
                              item.id,
                              input,
                            ),
                        })
                      }
                      onDelete={() =>
                        deleteExerciseSpeakingAnswer(
                          payload.attempt.id,
                          item.id,
                        )
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
                    audioPlayback="student-source"
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={submit}
        disabled={isSubmitting || hasPendingRecording}
      >
        {submitContent}
      </Button>
    </div>
  );
}

function AttemptMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="border-primary-300 bg-primary-700 rounded-lg border p-3">
      <p className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function questionTone(index: number) {
  return [
    {
      surface: "bg-student-sky-surface",
      border: "border-student-sky-border",
      ink: "text-student-sky-ink",
    },
    {
      surface: "bg-student-cyan-surface",
      border: "border-student-cyan-border",
      ink: "text-student-cyan-ink",
    },
    {
      surface: "bg-student-amber-surface",
      border: "border-student-amber-border",
      ink: "text-student-amber-ink",
    },
    {
      surface: "bg-student-coral-surface",
      border: "border-student-coral-border",
      ink: "text-student-coral-ink",
    },
  ][index % 4]!;
}
