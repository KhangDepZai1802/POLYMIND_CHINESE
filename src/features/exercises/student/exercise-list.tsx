"use client";

import Link from "next/link";
import { useState } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { startExerciseAction } from "@/features/exercises/server/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudentExerciseOverview } from "@/features/assessment-results/server/overview";

type Tab = "todo" | "doing" | "submitted" | "graded" | "overdue";

export function StudentExerciseList({
  deliveries,
  initialTab = "todo",
}: {
  deliveries: StudentExerciseOverview[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [now] = useState(() => Date.now());
  const filtered = deliveries.filter((delivery) => {
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
  });
  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="todo">Cần làm</TabsTrigger>
          <TabsTrigger value="doing">Đang làm</TabsTrigger>
          <TabsTrigger value="submitted">Đã nộp</TabsTrigger>
          <TabsTrigger value="graded">Đã chấm</TabsTrigger>
          <TabsTrigger value="overdue">Quá hạn</TabsTrigger>
        </TabsList>
      </Tabs>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          Không có bài trong nhóm này.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((delivery) => (
            <ExerciseCard key={delivery.id} delivery={delivery} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ delivery }: { delivery: StudentExerciseOverview }) {
  const active = delivery.attempts.find((attempt) =>
    ["in_progress", "returned_for_revision"].includes(attempt.status),
  );
  const published = delivery.attempts.find(
    (attempt) => attempt.results_published_at,
  );
  const submitted = delivery.attempts.find((attempt) => attempt.submitted_at);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{delivery.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {delivery.class.code} — {delivery.class.name}
        </p>
        <p className="text-muted-foreground">
          Hạn {new Date(delivery.due_at).toLocaleString("vi-VN")}
        </p>
        {published && (
          <p className="font-semibold text-emerald-700">
            Điểm: {published.final_score}/{delivery.max_score}
          </p>
        )}
        {published ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/student/exercises/results/${published.id}`}>
              Xem kết quả
            </Link>
          </Button>
        ) : active ? (
          <Button asChild>
            <Link
              href={`/student/exercises/${delivery.id}/attempt/${active.id}`}
            >
              Tiếp tục làm
            </Link>
          </Button>
        ) : submitted ? (
          <Button disabled>Đã nộp — chờ chấm</Button>
        ) : (
          <form action={startExerciseAction}>
            <input type="hidden" name="delivery_id" value={delivery.id} />
            <SubmitButton pendingText="Đang mở bài tập…">
              Bắt đầu làm
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
