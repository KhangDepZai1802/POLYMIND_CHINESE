"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamIntegrityBoundary } from "@/features/exams/integrity/exam-integrity-boundary";
import {
  saveExamAnswer,
  submitExamAttempt,
} from "@/features/exams/server/actions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import { Button } from "@/components/ui/button";
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
export function ExamAttempt({ payload }: { payload: Payload }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(payload.items.map((i) => [i.id, i.answer ?? {}])),
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
  const answersRef = useRef(answers);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submitted = useRef(false);
  const finish = useCallback(async (reason: "manual" | "duration_expired" = "manual") => {
    if (submitted.current) return;
    submitted.current = true;
    await Promise.all(
      Object.entries(answersRef.current).map(([id, value]) =>
        saveExamAnswer(payload.attempt.id, id, value),
      ),
    );
    const result = await submitExamAttempt(payload.attempt.id, reason);
    if (!result.ok) {
      submitted.current = false;
      setError(result.error);
      return;
    }
    window.dispatchEvent(new Event("navstart"));
    router.push("/student/exams");
    router.refresh();
  }, [payload.attempt.id, router]);
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
              onClick={() => {
                if (window.confirm("Nộp bài thi sớm?")) void finish();
              }}
            >
              Nộp bài
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-destructive rounded border p-3">{error}</p>
        )}
        {payload.items.map((item, index) => (
          <section key={item.id} className="bg-card rounded-xl border p-5">
            <p className="mb-4 text-sm font-semibold">
              Câu {index + 1} · {item.points} điểm
            </p>
            <QuestionRenderer
              type={item.question.type}
              prompt={item.question.prompt_text}
              promptContent={item.question.prompt_content}
              options={item.question.options}
              value={answers[item.id]}
              onChange={(value) => change(item.id, value)}
            />
          </section>
        ))}
      </div>
    </ExamIntegrityBoundary>
  );
}
