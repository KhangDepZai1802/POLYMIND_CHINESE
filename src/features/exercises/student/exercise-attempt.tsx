"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveExerciseAnswer,
  submitExerciseAttempt,
} from "@/features/exercises/server/actions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import { Button } from "@/components/ui/button";
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
export function ExerciseAttempt({ payload }: { payload: Payload }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(
      payload.items.map((item) => [item.id, item.answer ?? {}]),
    ),
  );
  const [saved, setSaved] = useState("Đã tải câu trả lời đã lưu");
  const [error, setError] = useState<string>();
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
    if (
      !window.confirm("Nộp bài ngay? Bạn không thể sửa lượt này sau khi nộp.")
    )
      return;
    await Promise.all(
      Object.entries(answers).map(([itemId, value]) =>
        saveExerciseAnswer(payload.attempt.id, itemId, value),
      ),
    );
    const result = await submitExerciseAttempt(payload.attempt.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.dispatchEvent(new Event("navstart"));
    router.push("/student/exercises");
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <div className="bg-background/95 sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-sm backdrop-blur">
        <div>
          <p className="font-semibold">{payload.delivery.title}</p>
          <p className="text-muted-foreground text-xs">{saved}</p>
        </div>
        <Button onClick={submit}>Nộp bài</Button>
      </div>
      {error && (
        <p className="text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      <div className="space-y-6">
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
      <Button className="w-full" size="lg" onClick={submit}>
        Nộp bài
      </Button>
    </div>
  );
}
