"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Download, Users } from "lucide-react";

import {
  gradeExerciseAnswersBulkAction,
  publishExerciseResultsAction,
} from "@/features/exercises/server/actions";
import {
  gradeExamAnswersBulkAction,
  lockExamResultsAction,
  publishExamResultsAction,
  runExamRegradeAction,
} from "@/features/exams/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";
import { AssessmentAudioPlayer } from "@/features/assessment-results/components/audio-player";

type Option = { option_key: string; content: string };
type Answer = {
  id: string;
  answer_payload: unknown;
  audio_url?: string | null;
  prompt_audio_url?: string | null;
  auto_score: number | null;
  manual_score: number | null;
  final_score: number | null;
  feedback: string | null;
  override_reason: string | null;
  item: {
    points: number;
    order_index: number;
    question_version: {
      id: string;
      question_type: string;
      prompt_text: string;
      options?: Option[];
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

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Đang làm",
  submitted: "Đã nộp",
  pending_manual_grading: "Còn câu chưa chấm",
  graded: "Đã chấm xong",
  returned_for_revision: "Đã trả để làm lại",
  invalidated: "Không tính kết quả",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? "Đang xử lý";
}

function unansweredCount(attempt: Attempt) {
  return attempt.answers.filter((answer) => answer.final_score === null).length;
}

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
  const gradableAttempts = delivery.attempts.filter(
    (attempt) => !["in_progress", "invalidated"].includes(attempt.status),
  );
  const [selectedId, setSelectedId] = useState(gradableAttempts[0]?.id);
  const selected = gradableAttempts.find((attempt) => attempt.id === selectedId);
  const publish = useFormAction(
    kind === "exercise" ? publishExerciseResultsAction : publishExamResultsAction,
    { toastError: true },
  );
  const regrade = useFormAction(runExamRegradeAction, { toastError: true });
  const lock = useFormAction(lockExamResultsAction, { toastError: true });
  const pending = gradableAttempts.filter((attempt) => unansweredCount(attempt) > 0).length;

  const exportCsv = () => {
    const rows = [
      ["Học viên", "Mã học viên", "Tình trạng", "Điểm", "Số lần rời màn hình"],
      ...delivery.attempts.map((attempt) => [
        attempt.enrollment?.student?.full_name ?? "",
        attempt.enrollment?.student?.student_code ?? "",
        statusLabel(attempt.status),
        String(attempt.final_score_100 ?? attempt.final_score ?? ""),
        String(attempt.integrity_events?.length ?? 0),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${kind === "exercise" ? "diem-bai-tap" : "diem-ky-thi"}-${delivery.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" aria-hidden /> Học viên đã nộp
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Chọn học viên để xem và chấm toàn bộ bài làm.
            </p>
          </CardHeader>
          <CardContent className="max-h-[52vh] space-y-1 overflow-y-auto">
            {gradableAttempts.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">Chưa có bài nộp.</p>
            )}
            {gradableAttempts.map((attempt) => {
              const left = unansweredCount(attempt);
              return (
                <Button
                  key={attempt.id}
                  type="button"
                  variant={attempt.id === selectedId ? "secondary" : "ghost"}
                  className="h-auto w-full justify-between gap-2 px-3 py-2.5 text-left"
                  onClick={() => setSelectedId(attempt.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {attempt.enrollment?.student?.full_name ?? "Học viên"}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {attempt.enrollment?.student?.student_code || "Chưa có mã"}
                    </span>
                  </span>
                  {left > 0 ? (
                    <Badge variant="destructive" className="shrink-0">{left} chưa chấm</Badge>
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Đã chấm xong" />
                  )}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <Button type="button" variant="outline" className="w-full" onClick={exportCsv}>
              <Download className="size-4" aria-hidden /> Tải bảng điểm lớp
            </Button>
            <p className="text-muted-foreground text-sm">
              {pending > 0 ? `Còn ${pending} học viên có câu chưa chấm.` : "Tất cả bài nộp đã được chấm."}
            </p>
            {kind === "exam" && (
              <form action={lock.formAction}>
                <input type="hidden" name="delivery_id" value={delivery.id} />
                <SubmitButton variant="outline" className="w-full" disabled={pending > 0}>
                  Hoàn tất chấm điểm
                </SubmitButton>
              </form>
            )}
            <form action={publish.formAction}>
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <SubmitButton className="w-full" disabled={pending > 0}>
                Công bố kết quả cho học viên
              </SubmitButton>
            </form>
            {kind === "exam" && (
              <details className="border-t pt-3 text-sm">
                <summary className="cursor-pointer font-medium">Tính lại điểm hệ thống chấm</summary>
                <form action={regrade.formAction} className="mt-3 space-y-2">
                  <input type="hidden" name="delivery_id" value={delivery.id} />
                  <Label htmlFor="regrade-reason">Lý do tính lại điểm</Label>
                  <Input id="regrade-reason" name="reason" required />
                  <SubmitButton variant="outline" className="w-full">Tính lại điểm</SubmitButton>
                </form>
              </details>
            )}
          </CardContent>
        </Card>
      </aside>

      <main className="min-w-0 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{delivery.title}</h2>
          <p className="text-muted-foreground text-sm">
            {delivery.class?.code} — {delivery.class?.name}
          </p>
        </div>
        {!selected ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Chọn một học viên để bắt đầu chấm.</CardContent></Card>
        ) : (
          <StudentGradingForm key={selected.id} kind={kind} deliveryId={delivery.id} attempt={selected} />
        )}
      </main>
    </div>
  );
}

type Draft = { score: string; feedback: string; overrideReason: string; adjusting: boolean };
const EMPTY_DRAFT: Draft = { score: "", feedback: "", overrideReason: "", adjusting: false };

function StudentGradingForm({
  kind,
  deliveryId,
  attempt,
}: {
  kind: "exercise" | "exam";
  deliveryId: string;
  attempt: Attempt;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const sortedAnswers = [...attempt.answers].sort(
    (a, b) => (a.item?.order_index ?? 0) - (b.item?.order_index ?? 0),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(sortedAnswers.map((answer) => [
      answer.id,
      {
        score: answer.manual_score === null ? "" : String(answer.manual_score),
        feedback: answer.feedback ?? "",
        overrideReason: answer.override_reason ?? "",
        adjusting: answer.auto_score !== null && answer.manual_score !== null,
      },
    ])),
  );
  const save = useFormAction(
    kind === "exercise" ? gradeExerciseAnswersBulkAction : gradeExamAnswersBulkAction,
    { onSuccess: () => router.refresh(), toastError: true },
  );

  const manualAnswers = sortedAnswers.filter((answer) => answer.auto_score === null);
  const ungraded = manualAnswers.filter((answer) => !drafts[answer.id]?.score.trim()).length;
  const entered = manualAnswers.length - ungraded;
  const grades = sortedAnswers.flatMap((answer) => {
    const draft = drafts[answer.id] ?? EMPTY_DRAFT;
    const shouldSave = answer.auto_score === null || draft.adjusting;
    if (!shouldSave || !draft.score.trim()) return [];
    return [{
      answer_id: answer.id,
      score: Number(draft.score),
      feedback: draft.feedback,
      override_reason: draft.overrideReason,
    }];
  });

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? EMPTY_DRAFT), ...patch },
    }));
  };
  const requestSave = () => {
    if (ungraded > 0) setWarningOpen(true);
    else formRef.current?.requestSubmit();
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-semibold">
              {attempt.enrollment?.student?.full_name ?? "Học viên"}
            </p>
            <p className="text-muted-foreground text-sm">
              {manualAnswers.length === 0
                ? "Các câu đã được hệ thống chấm. Giáo viên có thể xem hoặc điều chỉnh khi cần."
                : `Đã nhập điểm ${entered}/${manualAnswers.length} câu cần giáo viên chấm.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={ungraded > 0 ? "destructive" : "default"}>
              {ungraded > 0 ? `${ungraded} câu chưa chấm` : "Đã chấm đủ"}
            </Badge>
            <Badge variant="outline">
              Điểm hiện tại: {attempt.final_score_100 ?? attempt.final_score ?? "Chưa có"}
            </Badge>
            {kind === "exam" && (
              <Badge variant="outline">
                {attempt.integrity_events?.length ?? 0} lần rời màn hình/cảnh báo
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <form ref={formRef} action={save.formAction} className="space-y-4">
        <input type="hidden" name="delivery_id" value={deliveryId} />
        <input type="hidden" name="grades" value={JSON.stringify(grades)} />
        {sortedAnswers.map((answer, index) => {
          const draft = drafts[answer.id] ?? EMPTY_DRAFT;
          const isAutomatic = answer.auto_score !== null;
          const hasScore = isAutomatic ? !draft.adjusting || Boolean(draft.score) : Boolean(draft.score);
          return (
            <Card key={answer.id}>
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Câu {index + 1} · tối đa {answer.item?.points ?? 0} điểm</CardTitle>
                  <Badge variant={hasScore ? "secondary" : "destructive"}>
                    {isAutomatic && !draft.adjusting
                      ? `Hệ thống chấm: ${answer.auto_score} điểm`
                      : hasScore ? "Đã nhập điểm" : "Chưa chấm"}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm font-medium">
                  {answer.item?.question_version?.prompt_text || "Câu hỏi"}
                </p>
                {answer.prompt_audio_url && (
                  <AssessmentAudioPlayer src={answer.prompt_audio_url} label="Audio đề bài" />
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 font-medium">Câu trả lời của học viên</p>
                  {answer.audio_url ? (
                    <AssessmentAudioPlayer
                      src={answer.audio_url}
                      label="Bản ghi âm học viên đã nộp"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {formatAnswer(answer.answer_payload, answer.item?.question_version?.options ?? [])}
                    </p>
                  )}
                </div>

                {isAutomatic && !draft.adjusting ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-sm">Hệ thống đã chấm câu này: <strong>{answer.auto_score}/{answer.item?.points ?? 0} điểm</strong></p>
                    <Button type="button" variant="outline" size="sm" onClick={() => updateDraft(answer.id, { adjusting: true, score: String(answer.final_score ?? answer.auto_score ?? "") })}>
                      Điều chỉnh điểm
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`score-${answer.id}`}>Điểm câu này</Label>
                      <Input
                        id={`score-${answer.id}`}
                        type="number"
                        min="0"
                        max={answer.item?.points ?? 0}
                        step="0.25"
                        value={draft.score}
                        placeholder="Chưa chấm"
                        onChange={(event) => updateDraft(answer.id, { score: event.target.value })}
                      />
                      <p className="text-muted-foreground text-xs">Nhập từ 0 đến {answer.item?.points ?? 0} điểm.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`feedback-${answer.id}`}>Nhận xét cho học viên</Label>
                      <Textarea
                        id={`feedback-${answer.id}`}
                        value={draft.feedback}
                        placeholder="Không bắt buộc"
                        onChange={(event) => updateDraft(answer.id, { feedback: event.target.value })}
                      />
                    </div>
                    {isAutomatic && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`reason-${answer.id}`}>Lý do điều chỉnh điểm hệ thống</Label>
                        <Input
                          id={`reason-${answer.id}`}
                          value={draft.overrideReason}
                          placeholder="Ví dụ: chấp nhận cách diễn đạt tương đương"
                          onChange={(event) => updateDraft(answer.id, { overrideReason: event.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {save.state.error && (
          <Alert variant="destructive"><AlertDescription>{save.state.error}</AlertDescription></Alert>
        )}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm">
            {ungraded > 0 ? <><strong>Còn {ungraded} câu chưa chấm.</strong> Có thể lưu phần đã nhập và chấm tiếp sau.</> : "Sau khi lưu, trang vẫn giữ tại học viên này để giáo viên kiểm tra lại."}
          </p>
          <SaveAllButton onClick={requestSave} disabled={grades.length === 0} />
        </div>
      </form>

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><CircleAlert className="size-5 text-amber-600" aria-hidden /> Còn {ungraded} câu chưa chấm</AlertDialogTitle>
            <AlertDialogDescription>
              Các câu còn trống sẽ tiếp tục hiển thị “Chưa chấm”. Hệ thống chưa cho công bố kết quả cho đến khi giáo viên chấm đủ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại chấm tiếp</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit()}>
              Vẫn lưu phần đã chấm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SaveAllButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="button" onClick={onClick} disabled={disabled || pending}>
      {pending ? "Đang lưu tất cả điểm…" : "Lưu tất cả điểm đã nhập"}
    </Button>
  );
}

function formatAnswer(value: unknown, options: Option[]): string {
  if (!value || typeof value !== "object") return "Chưa trả lời";
  const payload = value as Record<string, unknown>;
  const optionText = (key: unknown) => {
    const text = options.find((option) => option.option_key === String(key))?.content;
    if (text) return text;
    if (String(key) === "true") return "Đúng";
    if (String(key) === "false") return "Sai";
    return String(key ?? "");
  };
  if (Array.isArray(payload.values)) {
    const values = payload.values.map(optionText).filter(Boolean);
    return values.length ? values.join("; ") : "Chưa trả lời";
  }
  if (Array.isArray(payload.value)) {
    const values = payload.value.map(optionText).filter(Boolean);
    return values.length ? values.join(" → ") : "Chưa trả lời";
  }
  if (payload.value !== undefined && payload.value !== null && payload.value !== "") {
    return optionText(payload.value);
  }
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text;
  if (typeof payload.audio_path === "string") return "Bài thu âm của học viên";
  return "Chưa trả lời";
}
