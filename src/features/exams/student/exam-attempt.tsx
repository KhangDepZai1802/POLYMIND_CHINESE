"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MicrophoneCheck } from "@/components/shared/microphone-check";
import { ExamIntegrityBoundary } from "@/features/exams/integrity/exam-integrity-boundary";
import {
  deleteExamSpeakingAnswer,
  saveExamAnswer,
  submitExamAttempt,
  uploadExamSpeakingAnswer,
} from "@/features/exams/server/actions";
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
    deadline_at: string;
    server_time: string;
  };
  delivery: {
    id: string;
    title: string;
    closes_at: string;
    duration_minutes: number;
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

export function ExamAttempt({ payload }: { payload: Payload }) {
  const confirm = useConfirmation();
  const router = useRouter();
  // Câu Nói tự lưu qua recorder (RPC riêng) — không đưa vào state chung để
  // vòng lưu-khi-nộp không ghi đè answer_payload đã có audio_path.
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(
      payload.items
        .filter((i) => i.question.type !== "speaking")
        .map((i) => [i.id, i.answer ?? {}]),
    ),
  );
  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      Math.floor(
        (new Date(payload.attempt.deadline_at).getTime() -
          new Date(payload.attempt.server_time).getTime()) /
          1000,
      ),
    ),
  );
  const [saved, setSaved] = useState("Đã tải dữ liệu");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPendingRecording, setHasPendingRecording] = useState(false);
  const answersRef = useRef(answers);
  const speakingStatusesRef = useRef<Record<string, SpeakingRecorderStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submitted = useRef(false);
  const finish = useCallback(
    async (reason: "manual" | "duration_expired" = "manual") => {
      if (submitted.current) return;
      if (
        reason === "manual" &&
        Object.values(speakingStatusesRef.current).some((status) =>
          ["recording", "recorded", "uploading", "upload_error"].includes(
            status,
          ),
        )
      ) {
        setSaved("Chưa thể nộp — bản ghi âm chưa được lưu");
        setError(
          "Hãy dừng thu và đợi đến khi câu Nói hiện “Đã nộp bản ghi” rồi nộp bài thi.",
        );
        return;
      }
      submitted.current = true;
      setIsSubmitting(true);
      setError(undefined);
      setSaved("Đang lưu lần cuối và nộp bài thi…");
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
      try {
        const saveResults = await Promise.all(
          Object.entries(answersRef.current).map(([id, value]) =>
            saveExamAnswer(payload.attempt.id, id, value),
          ),
        );
        const failedSave = saveResults.find((result) => !result.ok);
        if (failedSave) {
          submitted.current = false;
          setIsSubmitting(false);
          setSaved("Chưa nộp — có câu trả lời chưa lưu được");
          setError(failedSave.error ?? "Không lưu được câu trả lời cuối cùng.");
          return;
        }
        const result = await submitExamAttempt(payload.attempt.id, reason);
        if (!result.ok) {
          submitted.current = false;
          setIsSubmitting(false);
          setSaved("Chưa nộp bài thi");
          setError(result.error);
          return;
        }
        setSaved("Đã nộp bài thi thành công");
        toast.success(
          reason === "duration_expired"
            ? "Đã hết giờ và hệ thống đã nộp bài thi."
            : "Đã nộp bài thi thành công.",
        );
        window.dispatchEvent(new Event("navstart"));
        router.replace("/student/exams");
      } catch {
        submitted.current = false;
        setIsSubmitting(false);
        setSaved("Chưa nộp bài thi");
        setError(
          "Mất kết nối khi nộp bài thi. Câu trả lời vẫn được giữ để bạn thử lại.",
        );
      }
    },
    [payload.attempt.id, router],
  );
  useEffect(() => {
    const timer = setInterval(
      () =>
        setRemaining((value) => {
          if (value <= 1) {
            clearInterval(timer);
            void finish("duration_expired");
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [finish]);
  const change = (id: string, value: unknown) => {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      answersRef.current = next;
      return next;
    });
    setSaved("Đang lưu…");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const result = await saveExamAnswer(payload.attempt.id, id, value);
      setSaved(
        result.ok
          ? `Đã lưu lúc ${new Date(result.savedAt!).toLocaleTimeString("vi-VN")}`
          : "Chưa lưu",
      );
      if (!result.ok) setError(result.error);
    }, 1000);
  };
  const minutes = Math.floor(remaining / 60),
    seconds = remaining % 60;
  const requiresMicrophone = payload.items.some(
    (item) => item.question.type === "speaking",
  );
  return (
    <ExamIntegrityBoundary attemptId={payload.attempt.id}>
      <div className="space-y-6">
        <div className="bg-background/95 sticky top-2 z-30 flex items-center justify-between rounded-xl border p-3 shadow-md">
          <div>
            <p className="font-semibold">{payload.delivery.title}</p>
            <p className="text-muted-foreground text-xs">{saved}</p>
          </div>
          <div className="text-right">
            <p
              className={`font-mono text-xl font-bold ${remaining <= 60 ? "text-destructive" : ""}`}
            >
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </p>
            <Button
              size="sm"
              disabled={isSubmitting || hasPendingRecording}
              onClick={async () => {
                const accepted = await confirm({
                  title: "Nộp bài thi sớm?",
                  description:
                    "Lượt thi sẽ kết thúc ngay và bạn không thể sửa câu trả lời sau khi nộp.",
                  confirmLabel: "Nộp bài thi",
                });
                if (accepted) void finish();
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Đang nộp…
                </>
              ) : (
                "Nộp bài"
              )}
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-destructive rounded border p-3">{error}</p>
        )}
        {requiresMicrophone && <MicrophoneCheck />}
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
                  onStatusChange={(status) => {
                    const next = {
                      ...speakingStatusesRef.current,
                      [item.id]: status,
                    };
                    speakingStatusesRef.current = next;
                    setHasPendingRecording(
                      Object.values(next).some((value) =>
                        [
                          "recording",
                          "recorded",
                          "uploading",
                          "upload_error",
                        ].includes(value),
                      ),
                    );
                  }}
                  onUpload={(blob, durationMs) => {
                    const fd = new FormData();
                    fd.set("audio", blob, "speaking");
                    fd.set("duration_ms", String(durationMs));
                    return uploadExamSpeakingAnswer(
                      payload.attempt.id,
                      item.id,
                      fd,
                    );
                  }}
                  onDelete={() =>
                    deleteExamSpeakingAnswer(payload.attempt.id, item.id)
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
    </ExamIntegrityBoundary>
  );
}
