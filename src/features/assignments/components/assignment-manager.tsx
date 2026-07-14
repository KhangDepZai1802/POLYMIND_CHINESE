"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  closeAssignmentAction,
  createAssignmentAction,
  createAssignmentUploadUrlAction,
  deleteAssignmentAttachmentAction,
  deleteDraftAssignmentAction,
  getAssignmentAttachmentDownloadUrlAction,
  publishAssignmentAction,
  registerAssignmentAttachmentAction,
  updateAssignmentAction,
} from "@/features/assignments/server/actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { formatDateTime, formatScore, toDateTimeInputValue } from "@/lib/dates";
import {
  ALLOWED_FILE_EXTENSIONS,
  ASSIGNMENT_FILES_BUCKET,
  MAX_ASSIGNMENT_FILE_SIZE_BYTES,
  fileExtension,
  formatFileSize,
} from "@/lib/domain/files";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TONE,
  SESSION_STATUS_LABELS,
} from "@/lib/domain/labels";
import { createClient } from "@/lib/supabase/client";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
type SessionStatus = Database["public"]["Enums"]["session_status"];

type Attachment = {
  id: string;
  object_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Assignment = {
  id: string;
  class_id: string;
  lesson_id: string | null;
  session_id: string | null;
  title: string;
  instructions: string | null;
  due_at: string | null;
  max_score: number;
  allow_late_submission: boolean;
  max_attempts: number;
  status: AssignmentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  lesson: { id: string; title: string } | null;
  session: {
    id: string;
    session_number: number;
    starts_at: string;
    topic: string | null;
  } | null;
  assignment_attachments: Attachment[];
  submissions: {
    id: string;
    status: Database["public"]["Enums"]["submission_status"];
    submitted_at: string | null;
    graded_at: string | null;
  }[];
};

type LessonOption = { id: string; label: string };
type SessionOption = {
  id: string;
  session_number: number;
  starts_at: string;
  status: SessionStatus;
  topic: string | null;
  lesson_id: string | null;
};

const ACCEPT = ALLOWED_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(
  ",",
);

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function AssignmentManager({
  classId,
  assignments,
  lessons,
  sessions,
}: {
  classId: string;
  assignments: Assignment[];
  lessons: LessonOption[];
  sessions: SessionOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Bài tập của lớp</h2>
          <p className="text-muted-foreground text-sm">
            Lưu nháp trước, rà soát nội dung và tệp rồi mới bấm Giao bài. Học
            viên không thể thấy bản nháp, kể cả gọi Storage trực tiếp.
          </p>
        </div>
        <AssignmentDialog
          classId={classId}
          lessons={lessons}
          sessions={sessions}
        />
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileCheck2}
              title="Chưa có bài tập"
              description="Tạo bản nháp, đính kèm đề bài nếu cần, sau đó giao bài bằng một hành động riêng."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              lessons={lessons}
              sessions={sessions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  lessons,
  sessions,
}: {
  assignment: Assignment;
  lessons: LessonOption[];
  sessions: SessionOption[];
}) {
  const submittedCount = assignment.submissions.filter(
    (submission) => submission.submitted_at,
  ).length;
  const gradedCount = assignment.submissions.filter(
    (submission) => submission.graded_at,
  ).length;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{assignment.title}</CardTitle>
              <StatusBadge
                label={ASSIGNMENT_STATUS_LABELS[assignment.status]}
                tone={ASSIGNMENT_STATUS_TONE[assignment.status]}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Hạn {formatDateTime(assignment.due_at)} · Tối đa{" "}
              {formatScore(assignment.max_score)} điểm ·{" "}
              {assignment.max_attempts} lần nộp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {assignment.status !== "draft" && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/teacher/assignments/${assignment.id}`}>
                  <ClipboardCheck className="size-4" aria-hidden />
                  Chấm bài ({submittedCount})
                </Link>
              </Button>
            )}
            {assignment.status !== "closed" && (
              <AssignmentDialog
                classId={assignment.class_id}
                lessons={lessons}
                sessions={sessions}
                assignment={assignment}
              />
            )}
            {assignment.status === "draft" && (
              <PublishButton assignment={assignment} />
            )}
            {assignment.status === "published" && (
              <CloseButton assignment={assignment} />
            )}
            {assignment.status === "draft" && (
              <DeleteDraftButton assignment={assignment} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {assignment.instructions && (
          <p className="text-sm whitespace-pre-wrap">
            {assignment.instructions}
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>{submittedCount} bài đã nộp</span>
          <span>{gradedCount} bài đã chấm</span>
          <span>
            Nộp muộn:{" "}
            {assignment.allow_late_submission ? "Cho phép" : "Không cho phép"}
          </span>
          {assignment.lesson && <span>Bài học: {assignment.lesson.title}</span>}
          {assignment.session && (
            <span>Buổi {assignment.session.session_number}</span>
          )}
          {assignment.published_at && (
            <span>Đã giao {formatDateTime(assignment.published_at)}</span>
          )}
        </div>

        <AttachmentPanel assignment={assignment} />
      </CardContent>
    </Card>
  );
}

function AssignmentDialog({
  classId,
  lessons,
  sessions,
  assignment,
}: {
  classId: string;
  lessons: LessonOption[];
  sessions: SessionOption[];
  assignment?: Assignment;
}) {
  const [open, setOpen] = useState(false);
  const action = assignment ? updateAssignmentAction : createAssignmentAction;
  const { state, formAction } = useFormAction(action, {
    onSuccess: () => setOpen(false),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {assignment ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa ${assignment.title}`}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            Tạo bài tập
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {assignment ? "Sửa bài tập" : "Tạo bản nháp bài tập"}
          </DialogTitle>
          <DialogDescription>
            {assignment?.status === "published"
              ? "Thay đổi có hiệu lực ngay với học viên vì bài này đã được giao."
              : "Lưu form chỉ tạo/cập nhật bản nháp; không tự động giao cho học viên."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="class_id" value={classId} />
          {assignment && (
            <input type="hidden" name="id" value={assignment.id} />
          )}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`assignment-title-${assignment?.id ?? "new"}`}>
              Tên bài tập *
            </Label>
            <Input
              id={`assignment-title-${assignment?.id ?? "new"}`}
              name="title"
              required
              defaultValue={assignment?.title ?? ""}
              placeholder="Bài tập nghe — Bài 3"
            />
            <FieldError message={errors["title"]} />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor={`assignment-instructions-${assignment?.id ?? "new"}`}
            >
              Yêu cầu
            </Label>
            <Textarea
              id={`assignment-instructions-${assignment?.id ?? "new"}`}
              name="instructions"
              rows={5}
              defaultValue={assignment?.instructions ?? ""}
              placeholder="Mô tả yêu cầu, cách làm và tiêu chí chấm…"
            />
            <FieldError message={errors["instructions"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`assignment-due-${assignment?.id ?? "new"}`}>
                Hạn nộp
              </Label>
              <Input
                id={`assignment-due-${assignment?.id ?? "new"}`}
                name="due_at"
                type="datetime-local"
                defaultValue={toDateTimeInputValue(assignment?.due_at)}
              />
              <FieldError message={errors["due_at"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`assignment-score-${assignment?.id ?? "new"}`}>
                Điểm tối đa *
              </Label>
              <Input
                id={`assignment-score-${assignment?.id ?? "new"}`}
                name="max_score"
                type="number"
                min="0.01"
                max="999.99"
                step="0.01"
                required
                defaultValue={assignment?.max_score ?? 100}
              />
              <FieldError message={errors["max_score"]} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`assignment-attempts-${assignment?.id ?? "new"}`}>
                Số lần nộp *
              </Label>
              <Input
                id={`assignment-attempts-${assignment?.id ?? "new"}`}
                name="max_attempts"
                type="number"
                min="1"
                max="20"
                required
                defaultValue={assignment?.max_attempts ?? 1}
              />
              <FieldError message={errors["max_attempts"]} />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox
                id={`assignment-late-${assignment?.id ?? "new"}`}
                name="allow_late_submission"
                defaultChecked={assignment?.allow_late_submission ?? true}
              />
              <Label htmlFor={`assignment-late-${assignment?.id ?? "new"}`}>
                Cho phép nộp sau hạn
              </Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`assignment-lesson-${assignment?.id ?? "new"}`}>
                Gắn bài học
              </Label>
              <Select
                name="lesson_id"
                defaultValue={assignment?.lesson_id ?? "none"}
              >
                <SelectTrigger
                  id={`assignment-lesson-${assignment?.id ?? "new"}`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn bài học</SelectItem>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["lesson_id"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`assignment-session-${assignment?.id ?? "new"}`}>
                Gắn buổi học
              </Label>
              <Select
                name="session_id"
                defaultValue={assignment?.session_id ?? "none"}
              >
                <SelectTrigger
                  id={`assignment-session-${assignment?.id ?? "new"}`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn buổi học</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      Buổi {session.session_number} ·{" "}
                      {formatDateTime(session.starts_at)} ·{" "}
                      {SESSION_STATUS_LABELS[session.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["session_id"]} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>
              {assignment ? "Lưu thay đổi" : "Lưu bản nháp"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PublishButton({ assignment }: { assignment: Assignment }) {
  const { formAction } = useFormAction(publishAssignmentAction, {
    toastError: true,
  });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Giao bài “${assignment.title}” cho học viên? Hành động này sẽ gửi thông báo.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assignment.id} />
      <input type="hidden" name="class_id" value={assignment.class_id} />
      <Button type="submit" size="sm">
        <Send className="size-4" aria-hidden />
        Giao bài
      </Button>
    </form>
  );
}

function CloseButton({ assignment }: { assignment: Assignment }) {
  const { formAction } = useFormAction(closeAssignmentAction, {
    toastError: true,
  });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Đóng bài “${assignment.title}”? Học viên sẽ không thể nộp thêm, lịch sử vẫn được giữ.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assignment.id} />
      <input type="hidden" name="class_id" value={assignment.class_id} />
      <Button type="submit" variant="outline" size="sm">
        <Archive className="size-4" aria-hidden />
        Đóng bài
      </Button>
    </form>
  );
}

function DeleteDraftButton({ assignment }: { assignment: Assignment }) {
  const { formAction } = useFormAction(deleteDraftAssignmentAction, {
    toastError: true,
  });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Xóa vĩnh viễn bản nháp “${assignment.title}” và toàn bộ tệp đính kèm?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assignment.id} />
      <input type="hidden" name="class_id" value={assignment.class_id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Xóa ${assignment.title}`}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}

function AttachmentPanel({ assignment }: { assignment: Assignment }) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="size-4" aria-hidden />
          Tệp đính kèm ({assignment.assignment_attachments.length})
        </div>
        {assignment.status !== "closed" && (
          <UploadAttachment assignment={assignment} />
        )}
      </div>

      {assignment.assignment_attachments.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-sm">
          Chưa có tệp đính kèm.
        </p>
      ) : (
        <ul className="divide-y">
          {assignment.assignment_attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              assignment={assignment}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadAttachment({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<ActionState>(EMPTY_ACTION_STATE);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return setState({ error: "Chọn tệp cần đính kèm." });
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
      const ticket = await createAssignmentUploadUrlAction({
        classId: assignment.class_id,
        assignmentId: assignment.id,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if ("error" in ticket) return setState({ error: ticket.error });

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ASSIGNMENT_FILES_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError)
        return setState({
          error: "Tải tệp lên thất bại. Kiểm tra kết nối rồi thử lại.",
        });

      const formData = new FormData();
      formData.set("assignment_id", assignment.id);
      formData.set("class_id", assignment.class_id);
      formData.set("object_path", ticket.path);
      formData.set("file_name", file.name);
      const result = await registerAssignmentAttachmentAction(
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
        aria-label={`Chọn tệp cho ${assignment.title}`}
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={uploading || !file}
      >
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

function AttachmentRow({
  attachment,
  assignment,
}: {
  attachment: Attachment;
  assignment: Assignment;
}) {
  const [downloading, setDownloading] = useState(false);
  const { formAction } = useFormAction(deleteAssignmentAttachmentAction, {
    toastError: true,
  });

  async function download() {
    setDownloading(true);
    const result = await getAssignmentAttachmentDownloadUrlAction(
      attachment.id,
    );
    setDownloading(false);
    if ("error" in result) return toast.error(result.error);
    window.location.href = result.url;
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
        <p className="text-muted-foreground text-xs">
          {formatFileSize(attachment.size_bytes)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={download}
        disabled={downloading}
        aria-label={`Tải ${attachment.file_name}`}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
      </Button>
      {assignment.status !== "closed" && (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!window.confirm(`Xóa tệp “${attachment.file_name}”?`))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={attachment.id} />
          <input type="hidden" name="class_id" value={assignment.class_id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label={`Xóa ${attachment.file_name}`}
          >
            <Trash2 className="text-destructive size-4" aria-hidden />
          </Button>
        </form>
      )}
    </li>
  );
}
