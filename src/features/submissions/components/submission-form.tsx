"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSubmissionFileDownloadUrlAction } from "@/features/assignments/server/grading-actions";
import {
  createSubmissionUploadUrlAction,
  deleteSubmissionFileAction,
  ensureSubmissionAction,
  registerSubmissionFileAction,
  submitAssignmentAction,
} from "@/features/submissions/server/actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { formatDateTime, formatScore } from "@/lib/dates";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_ASSIGNMENT_FILE_SIZE_BYTES,
  SUBMISSIONS_BUCKET,
  fileExtension,
  formatFileSize,
} from "@/lib/domain/files";
import { createClient } from "@/lib/supabase/client";
import { useFormAction } from "@/lib/use-form-action";

type SubmissionFile = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type MySubmission = {
  id: string;
  text_answer: string | null;
  submitted_at: string | null;
  is_late: boolean;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  submission_files: SubmissionFile[];
};

const ACCEPT = ALLOWED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export function SubmissionForm({
  assignmentId,
  maxScore,
  submission,
}: {
  assignmentId: string;
  maxScore: number;
  submission: MySubmission | null;
}) {
  const isGraded = submission?.graded_at != null;

  return (
    <div className="space-y-5">
      {isGraded && submission && (
        <Card className="border-success/40 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="text-success size-4" aria-hidden />
              Bài đã được chấm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">
              {formatScore(submission.score)}
              <span className="text-muted-foreground text-base font-normal">
                {" "}
                / {formatScore(maxScore)}
              </span>
            </p>
            {submission.feedback && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Nhận xét của giáo viên
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {submission.feedback}
                </p>
              </div>
            )}
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Lock className="size-3.5" aria-hidden />
              Bài đã chấm nên không sửa được nữa.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Bài làm của bạn</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {submission?.is_late && (
                <StatusBadge label="Nộp muộn" tone="warning" />
              )}
              <StatusBadge
                label={submission?.submitted_at ? "Đã nộp" : "Chưa nộp"}
                tone={submission?.submitted_at ? "success" : "neutral"}
              />
            </div>
          </div>
          {submission?.submitted_at && (
            <p className="text-muted-foreground mt-1 text-xs">
              Nộp lúc {formatDateTime(submission.submitted_at)}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          <TextAnswerForm
            assignmentId={assignmentId}
            submission={submission}
            disabled={isGraded}
          />

          <FilePanel
            assignmentId={assignmentId}
            submission={submission}
            disabled={isGraded}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TextAnswerForm({
  assignmentId,
  submission,
  disabled,
}: {
  assignmentId: string;
  submission: MySubmission | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const { state, formAction } = useFormAction(submitAssignmentAction, {
    onSuccess: () => router.refresh(),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assignment_id" value={assignmentId} />

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="text_answer">Câu trả lời</Label>
        <Textarea
          id="text_answer"
          name="text_answer"
          rows={8}
          maxLength={20000}
          disabled={disabled}
          defaultValue={submission?.text_answer ?? ""}
          placeholder="Nhập bài làm của bạn tại đây…"
        />
        {errors["text_answer"] && (
          <p className="text-destructive text-xs">{errors["text_answer"]}</p>
        )}
      </div>

      {!disabled && (
        <SubmitButton>
          {submission?.submitted_at ? "Cập nhật bài làm" : "Nộp bài"}
        </SubmitButton>
      )}
    </form>
  );
}

function FilePanel({
  assignmentId,
  submission,
  disabled,
}: {
  assignmentId: string;
  submission: MySubmission | null;
  disabled: boolean;
}) {
  const files = submission?.submission_files ?? [];

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-medium">Tệp đính kèm ({files.length})</p>
        {!disabled && <UploadFile assignmentId={assignmentId} />}
      </div>

      {files.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-sm">
          Chưa đính kèm tệp nào.
        </p>
      ) : (
        <ul className="divide-y">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              assignmentId={assignmentId}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadFile({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<ActionState>(EMPTY_ACTION_STATE);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return setState({ error: "Chọn tệp cần nộp." });
    if (!fileExtension(file.name)) {
      return setState({
        error: `Định dạng không được hỗ trợ. Cho phép: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`,
      });
    }
    if (file.size > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
      return setState({ error: "Tệp vượt quá 20 MB." });
    }

    setUploading(true);
    setState(EMPTY_ACTION_STATE);
    try {
      // File nằm ở `{class_id}/{submission_id}/…` nên phải có bài nộp trước. Nếu
      // học viên chỉ nộp file (không có text), bước này tự tạo bài nộp rỗng.
      const submission = await ensureSubmissionAction(assignmentId);
      if ("error" in submission) return setState({ error: submission.error });

      const ticket = await createSubmissionUploadUrlAction({
        submissionId: submission.submissionId,
        classId: submission.classId,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if ("error" in ticket) return setState({ error: ticket.error });

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(SUBMISSIONS_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) {
        return setState({
          error: "Tải tệp lên thất bại. Kiểm tra kết nối rồi thử lại.",
        });
      }

      const formData = new FormData();
      formData.set("submission_id", submission.submissionId);
      formData.set("assignment_id", assignmentId);
      formData.set("object_path", ticket.path);
      formData.set("file_name", file.name);
      const result = await registerSubmissionFileAction(
        EMPTY_ACTION_STATE,
        formData,
      );
      if (!result.success) return setState(result);

      toast.success(result.success);
      setFile(null);
      form.reset();
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <Input
        name="file"
        type="file"
        accept={ACCEPT}
        className="h-8 max-w-60 text-xs"
        disabled={uploading}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setState(EMPTY_ACTION_STATE);
        }}
        aria-label="Chọn tệp bài nộp"
      />
      <Button type="submit" variant="outline" size="sm" disabled={uploading || !file}>
        {uploading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4" aria-hidden />
        )}
        {uploading ? "Đang tải…" : "Đính kèm"}
      </Button>
      {state.error && (
        <p className="text-destructive w-full text-right text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}

function FileRow({
  file,
  assignmentId,
  disabled,
}: {
  file: SubmissionFile;
  assignmentId: string;
  disabled: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const { formAction } = useFormAction(deleteSubmissionFileAction, {
    toastError: true,
  });

  async function download() {
    setDownloading(true);
    const result = await getSubmissionFileDownloadUrlAction(file.id);
    setDownloading(false);
    if ("error" in result) return toast.error(result.error);
    window.location.href = result.url;
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
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
      {!disabled && (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!window.confirm(`Xóa tệp “${file.file_name}”?`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={file.id} />
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label={`Xóa ${file.file_name}`}
          >
            <Trash2 className="text-destructive size-4" aria-hidden />
          </Button>
        </form>
      )}
    </li>
  );
}
