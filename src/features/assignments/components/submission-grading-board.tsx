"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  Paperclip,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getSubmissionFileDownloadUrlAction,
  gradeSubmissionAction,
} from "@/features/assignments/server/grading-actions";
import { formatDateTime, formatScore } from "@/lib/dates";
import { formatFileSize } from "@/lib/domain/files";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONE,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

type SubmissionFile = {
  id: string;
  object_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Submission = {
  id: string;
  attempt_no: number;
  text_answer: string | null;
  submitted_at: string | null;
  is_late: boolean;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  enrollment: {
    id: string;
    status: Database["public"]["Enums"]["enrollment_status"];
    student: {
      id: string;
      student_code: string;
      full_name: string;
    } | null;
  } | null;
  submission_files: SubmissionFile[];
};

export function SubmissionGradingBoard({
  assignmentId,
  classId,
  maxScore,
  submissions,
}: {
  assignmentId: string;
  classId: string;
  maxScore: number;
  submissions: Submission[];
}) {
  const gradedCount = submissions.filter(
    (submission) => submission.graded_at,
  ).length;

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FileText}
            title="Chưa có bài nộp"
            description="Bài nộp text hoặc file của học viên sẽ xuất hiện tại đây sau khi gửi thành công."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Danh sách bài nộp</h2>
        <p className="text-muted-foreground text-sm">
          Đã chấm {gradedCount}/{submissions.length}
        </p>
      </div>

      {submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          assignmentId={assignmentId}
          classId={classId}
          maxScore={maxScore}
          submission={submission}
        />
      ))}
    </div>
  );
}

function SubmissionCard({
  assignmentId,
  classId,
  maxScore,
  submission,
}: {
  assignmentId: string;
  classId: string;
  maxScore: number;
  submission: Submission;
}) {
  const router = useRouter();
  const { state, formAction } = useFormAction(gradeSubmissionAction, {
    onSuccess: () => router.refresh(),
  });
  const errors = state.fieldErrors ?? {};
  const student = submission.enrollment?.student;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
              <UserRound className="text-muted-foreground size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {student?.full_name ?? "Học viên"}
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                {student?.student_code ?? "—"} · Nộp{" "}
                {formatDateTime(submission.submitted_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {submission.is_late && (
              <StatusBadge label="Nộp muộn" tone="warning" />
            )}
            <StatusBadge
              label={SUBMISSION_STATUS_LABELS[submission.status]}
              tone={SUBMISSION_STATUS_TONE[submission.status]}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <MessageSquareText className="size-4" aria-hidden />
              Nội dung trả lời
            </h3>
            {submission.text_answer ? (
              <div className="bg-muted/35 rounded-lg border p-4 text-sm whitespace-pre-wrap">
                {submission.text_answer}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                Học viên không gửi câu trả lời dạng text.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Paperclip className="size-4" aria-hidden />
              Tệp bài nộp ({submission.submission_files.length})
            </h3>
            {submission.submission_files.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                Học viên không đính kèm tệp.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {submission.submission_files.map((file) => (
                  <SubmissionFileRow key={file.id} file={file} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <form action={formAction} className="space-y-4 rounded-lg border p-4">
          <input type="hidden" name="submission_id" value={submission.id} />
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="class_id" value={classId} />

          <div>
            <h3 className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              Chấm bài
            </h3>
            {submission.graded_at && (
              <p className="text-muted-foreground mt-1 text-xs">
                Cập nhật gần nhất {formatDateTime(submission.graded_at)}
              </p>
            )}
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`score-${submission.id}`}>Điểm *</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`score-${submission.id}`}
                name="score"
                type="number"
                min="0"
                max={maxScore}
                step="0.01"
                required
                defaultValue={submission.score ?? ""}
                aria-describedby={`score-max-${submission.id}`}
              />
              <span
                id={`score-max-${submission.id}`}
                className="text-muted-foreground shrink-0 text-sm"
              >
                / {formatScore(maxScore)}
              </span>
            </div>
            <FieldError message={errors["score"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`feedback-${submission.id}`}>Nhận xét</Label>
            <Textarea
              id={`feedback-${submission.id}`}
              name="feedback"
              rows={5}
              maxLength={5000}
              defaultValue={submission.feedback ?? ""}
              placeholder="Điểm tốt, phần cần sửa và gợi ý luyện thêm…"
            />
            <FieldError message={errors["feedback"]} />
          </div>

          <SubmitButton className="w-full">
            {submission.graded_at ? "Cập nhật điểm" : "Lưu điểm"}
          </SubmitButton>
          <p className="text-muted-foreground text-xs">
            Lưu điểm sẽ gửi thông báo in-app cho học viên. Chấm lại không tạo
            thông báo trùng.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmissionFileRow({ file }: { file: SubmissionFile }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    const result = await getSubmissionFileDownloadUrlAction(file.id);
    setDownloading(false);

    if ("error" in result) return toast.error(result.error);
    window.location.href = result.url;
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.file_name}</p>
        <p className="text-muted-foreground text-xs">
          {formatFileSize(file.size_bytes)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={download}
        disabled={downloading}
        aria-label={`Tải ${file.file_name}`}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
      </Button>
    </li>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}
