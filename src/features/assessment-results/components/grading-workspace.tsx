"use client";

import { useState } from "react";
import {
  gradeExerciseAnswerAction,
  publishExerciseResultsAction,
} from "@/features/exercises/server/actions";
import {
  gradeExamAnswerAction,
  lockExamResultsAction,
  publishExamResultsAction,
  runExamRegradeAction,
} from "@/features/exams/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";

type Answer = {
  id: string;
  answer_payload: unknown;
  audio_url?: string | null;
  auto_score: number | null;
  manual_score: number | null;
  final_score: number | null;
  feedback: string | null;
  override_reason: string | null;
  item: {
    points: number;
    order_index: number;
    question_version: {
      question_type: string;
      prompt_text: string;
    } | null;
  } | null;
};

type Attempt = {
  id: string;
  status: string;
  submitted_at: string | null;
  raw_score: number | null;
  final_score?: number | null;
  final_score_100?: number | null;
  enrollment: {
    student: { student_code: string; full_name: string } | null;
  } | null;
  answers: Answer[];
  integrity_events?: Array<{ id: string; event_type: string; occurred_at: string }>;
};

export function GradingWorkspace({
  kind,
  delivery,
}: {
  kind: "exercise" | "exam";
  delivery: {
    id: string;
    title: string;
    status: string;
    results_published_at?: string | null;
    class: { code: string; name: string } | null;
    attempts: Attempt[];
  };
}) {
  const [selectedId, setSelectedId] = useState(delivery.attempts[0]?.id);
  const selected = delivery.attempts.find((attempt) => attempt.id === selectedId);
  const publish = useFormAction(
    kind === "exercise" ? publishExerciseResultsAction : publishExamResultsAction,
  );
  const regrade = useFormAction(runExamRegradeAction);
  const lock = useFormAction(lockExamResultsAction);
  const pending = delivery.attempts.filter(
    (attempt) => attempt.status === "pending_manual_grading",
  ).length;
  const exportCsv = () => {
    const rows = [["Học viên", "Mã", "Trạng thái", "Điểm", "Sự kiện integrity"], ...delivery.attempts.map((attempt) => [
      attempt.enrollment?.student?.full_name ?? "",
      attempt.enrollment?.student?.student_code ?? "",
      attempt.status,
      String(attempt.final_score_100 ?? attempt.final_score ?? ""),
      String(attempt.integrity_events?.length ?? 0),
    ])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${kind}-${delivery.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Lượt đã nộp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {delivery.attempts.length === 0 && (
            <p className="text-muted-foreground text-sm">Chưa có lượt nộp.</p>
          )}
          {delivery.attempts.map((attempt) => (
            <Button
              key={attempt.id}
              type="button"
              variant={attempt.id === selectedId ? "secondary" : "ghost"}
              className="h-auto w-full justify-start py-3 text-left"
              onClick={() => setSelectedId(attempt.id)}
            >
              <span>
                <span className="block font-medium">
                  {attempt.enrollment?.student?.full_name ?? "Học viên"}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {attempt.enrollment?.student?.student_code} · {attempt.status}
                </span>
              </span>
            </Button>
          ))}
          <div className="border-t pt-4">
            <Button type="button" variant="outline" className="mb-3 w-full" onClick={exportCsv}>Xuất CSV theo lớp</Button>
            <p className="mb-3 text-sm">Còn {pending} lượt chờ chấm.</p>
            {kind === "exam" && <form action={lock.formAction} className="mb-2 space-y-2"><input type="hidden" name="delivery_id" value={delivery.id}/><SubmitButton variant="outline" className="w-full" disabled={pending>0}>Khóa điểm</SubmitButton>{(lock.state.error||lock.state.success)&&<p className="text-xs">{lock.state.error??lock.state.success}</p>}</form>}
            <form action={publish.formAction} className="space-y-2">
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <SubmitButton className="w-full" disabled={pending > 0}>
                Công bố kết quả
              </SubmitButton>
              {publish.state.error && (
                <p className="text-destructive text-xs">{publish.state.error}</p>
              )}
              {publish.state.success && (
                <p className="text-xs text-emerald-700">{publish.state.success}</p>
              )}
            </form>
          </div>
          {kind === "exam" && (
            <form action={regrade.formAction} className="space-y-2 border-t pt-4">
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <Label htmlFor="regrade-reason">Lý do chấm lại</Label>
              <Input id="regrade-reason" name="reason" required />
              <SubmitButton variant="outline" className="w-full">
                Chấm lại tự động
              </SubmitButton>
              {(regrade.state.error || regrade.state.success) && (
                <p className="text-xs">{regrade.state.error ?? regrade.state.success}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">{delivery.title}</h2>
          <p className="text-muted-foreground text-sm">
            {delivery.class?.code} — {delivery.class?.name}
          </p>
        </div>
        {!selected ? (
          <p className="text-muted-foreground">Chọn một lượt để chấm.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{selected.status}</Badge>
              <Badge variant="outline">
                Điểm: {selected.final_score_100 ?? selected.final_score ?? "—"}
              </Badge>
              {kind === "exam" && (
                <Badge variant="outline">
                  {selected.integrity_events?.length ?? 0} sự kiện integrity
                </Badge>
              )}
            </div>
            {[...selected.answers]
              .sort(
                (a, b) =>
                  (a.item?.order_index ?? 0) - (b.item?.order_index ?? 0),
              )
              .map((answer, index) => (
                <AnswerGradeForm
                  key={answer.id}
                  kind={kind}
                  deliveryId={delivery.id}
                  answer={answer}
                  index={index}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function AnswerGradeForm({
  kind,
  deliveryId,
  answer,
  index,
}: {
  kind: "exercise" | "exam";
  deliveryId: string;
  answer: Answer;
  index: number;
}) {
  const form = useFormAction(
    kind === "exercise" ? gradeExerciseAnswerAction : gradeExamAnswerAction,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Câu {index + 1} · tối đa {answer.item?.points ?? 0} điểm
        </CardTitle>
        <p className="text-sm">{answer.item?.question_version?.prompt_text}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="mb-1 font-medium">Bài làm</p>
          {answer.audio_url ? (
            <audio controls preload="metadata" src={answer.audio_url} className="w-full">
              <track kind="captions" />
            </audio>
          ) : (
            <pre className="font-sans whitespace-pre-wrap break-words">
              {JSON.stringify(answer.answer_payload, null, 2)}
            </pre>
          )}
        </div>
        <form action={form.formAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="answer_id" value={answer.id} />
          <input type="hidden" name="delivery_id" value={deliveryId} />
          <div className="space-y-2">
            <Label>Điểm</Label>
            <Input
              name="score"
              type="number"
              min="0"
              max={answer.item?.points ?? 0}
              step="0.25"
              defaultValue={answer.manual_score ?? answer.final_score ?? 0}
              required
            />
            <p className="text-muted-foreground text-xs">
              Điểm tự động: {answer.auto_score ?? "chờ chấm"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Feedback</Label>
            <Textarea name="feedback" defaultValue={answer.feedback ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Lý do override (nếu sửa điểm tự động)</Label>
            <Input
              name="override_reason"
              defaultValue={answer.override_reason ?? ""}
            />
          </div>
          {form.state.error && (
            <Alert variant="destructive" className="md:col-span-2">
              <AlertDescription>{form.state.error}</AlertDescription>
            </Alert>
          )}
          <div className="md:col-span-2">
            <SubmitButton>Lưu điểm câu này</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
