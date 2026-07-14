"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Calculator, Send, UserRound } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_FIELDS } from "@/features/assessments/schema";
import {
  publishAssessmentResultsAction,
  saveAssessmentResultAction,
} from "@/features/assessments/server/actions";
import { formatDateTime, formatScore } from "@/lib/dates";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

type Result = {
  id: string;
  overall_score: number | null;
  listening_score: number | null;
  speaking_score: number | null;
  reading_score: number | null;
  writing_score: number | null;
  vocabulary_score: number | null;
  grammar_score: number | null;
  classification: string | null;
  feedback: string | null;
  graded_at: string | null;
  published_at: string | null;
};

export type ScoreRow = {
  id: string;
  status: EnrollmentStatus;
  student: { id: string; student_code: string; full_name: string } | null;
  result: Result | null;
};

export function AssessmentScoreBoard({
  assessmentId,
  classId,
  maxScore,
  publishedAt,
  rows,
}: {
  assessmentId: string;
  classId: string;
  maxScore: number;
  publishedAt: string | null;
  rows: ScoreRow[];
}) {
  const scored = rows.filter(
    (row) => row.result?.overall_score !== null && row.result !== null,
  ).length;
  const published = rows.filter((row) => row.result?.published_at).length;
  const pendingPublish = scored - published;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={UserRound}
            title="Lớp chưa có học viên đang học"
            description="Học viên đã rút hoặc chuyển lớp không nằm trong danh sách chấm điểm."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              Đã chấm {scored}/{rows.length} học viên · Đã công bố {published}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {pendingPublish > 0
                ? `${pendingPublish} kết quả đã chấm nhưng chưa công bố — học viên chưa nhìn thấy.`
                : "Kết quả đã chấm đều đã được công bố cho học viên."}
            </p>
          </div>
          <PublishButton
            assessmentId={assessmentId}
            classId={classId}
            pendingPublish={pendingPublish}
            publishedAt={publishedAt}
          />
        </CardContent>
      </Card>

      {rows.map((row) => (
        <ScoreCard
          key={row.id}
          assessmentId={assessmentId}
          classId={classId}
          maxScore={maxScore}
          row={row}
        />
      ))}
    </div>
  );
}

function PublishButton({
  assessmentId,
  classId,
  pendingPublish,
  publishedAt,
}: {
  assessmentId: string;
  classId: string;
  pendingPublish: number;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const { formAction } = useFormAction(publishAssessmentResultsAction, {
    toastError: true,
    onSuccess: () => router.refresh(),
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Công bố ${pendingPublish} kết quả cho học viên? Học viên sẽ thấy điểm và nhận thông báo.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assessmentId} />
      <input type="hidden" name="class_id" value={classId} />
      <Button type="submit" disabled={pendingPublish <= 0}>
        <Send className="size-4" aria-hidden />
        {publishedAt ? "Công bố kết quả mới" : "Công bố kết quả"}
      </Button>
    </form>
  );
}

function ScoreCard({
  assessmentId,
  classId,
  maxScore,
  row,
}: {
  assessmentId: string;
  classId: string;
  maxScore: number;
  row: ScoreRow;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction } = useFormAction(saveAssessmentResultAction, {
    onSuccess: () => router.refresh(),
  });
  const errors = state.fieldErrors ?? {};
  const result = row.result;

  /**
   * Điểm tổng = trung bình các kỹ năng ĐÃ nhập.
   *
   * Chỉ là phím tắt điền hộ ô điểm tổng — giáo viên vẫn sửa đè được, và DB vẫn là
   * nơi chốt thang điểm. Kỹ năng bỏ trống không bị tính là 0 (bỏ trống ≠ 0 điểm).
   */
  function fillAverage() {
    const form = formRef.current;
    if (!form) return;

    const values = SKILL_FIELDS.map((skill) => {
      const input = form.elements.namedItem(skill.name);
      return input instanceof HTMLInputElement ? input.value.trim() : "";
    })
      .filter((value) => value !== "")
      .map(Number)
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) return;

    const overall = form.elements.namedItem("overall_score");
    if (overall instanceof HTMLInputElement) {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      overall.value = (Math.round(average * 100) / 100).toString();
    }
  }

  return (
    <Card>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="assessment_id" value={assessmentId} />
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="enrollment_id" value={row.id} />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                <UserRound
                  className="text-muted-foreground size-4"
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.student?.full_name ?? "Học viên"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {row.student?.student_code ?? "—"} ·{" "}
                  {ENROLLMENT_STATUS_LABELS[row.status]}
                  {result?.graded_at &&
                    ` · Chấm lúc ${formatDateTime(result.graded_at)}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {result?.classification && (
                <StatusBadge label={result.classification} tone="info" />
              )}
              <StatusBadge
                label={result?.published_at ? "Đã công bố" : "Chưa công bố"}
                tone={result?.published_at ? "success" : "neutral"}
              />
            </div>
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <ScoreInput
              rowId={row.id}
              name="overall_score"
              label={`Tổng (/${formatScore(maxScore)})`}
              maxScore={maxScore}
              defaultValue={result?.overall_score}
              error={errors["overall_score"]}
              emphasis
            />
            {SKILL_FIELDS.map((skill) => (
              <ScoreInput
                key={skill.name}
                rowId={row.id}
                name={skill.name}
                label={skill.label}
                maxScore={maxScore}
                defaultValue={result?.[skill.name]}
                error={errors[skill.name]}
              />
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`feedback-${row.id}`}>Nhận xét</Label>
            <Textarea
              id={`feedback-${row.id}`}
              name="feedback"
              rows={2}
              maxLength={5000}
              defaultValue={result?.feedback ?? ""}
              placeholder="Điểm mạnh, phần cần cải thiện…"
            />
            <FieldError message={errors["feedback"]} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>{result ? "Cập nhật điểm" : "Lưu điểm"}</SubmitButton>
            <Button type="button" variant="outline" onClick={fillAverage}>
              <Calculator className="size-4" aria-hidden />
              Tính TB 6 kỹ năng
            </Button>
            <p className="text-muted-foreground text-xs">
              Lưu điểm chưa công bố cho học viên. Ô để trống nghĩa là chưa chấm,
              không phải 0 điểm.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ScoreInput({
  rowId,
  name,
  label,
  maxScore,
  defaultValue,
  error,
  emphasis,
}: {
  rowId: string;
  name: string;
  label: string;
  maxScore: number;
  defaultValue: number | null | undefined;
  error?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${name}-${rowId}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${name}-${rowId}`}
        name={name}
        type="number"
        min="0"
        max={maxScore}
        step="0.01"
        inputMode="decimal"
        defaultValue={defaultValue ?? ""}
        className={emphasis ? "font-semibold" : undefined}
      />
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}
