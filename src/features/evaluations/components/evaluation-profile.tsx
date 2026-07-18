"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { useConfirmSubmit } from "@/components/shared/confirmation-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RATING_FIELDS } from "@/features/evaluations/schema";
import {
  createEvaluationAction,
  createNoteAction,
  deleteEvaluationAction,
  deleteNoteAction,
  publishEvaluationAction,
  updateEvaluationAction,
} from "@/features/evaluations/server/actions";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/dates";
import {
  EVALUATION_RATING_LABELS,
  NOTE_VISIBILITY_LABELS,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type Rating = Database["public"]["Enums"]["evaluation_rating"];
type NoteVisibility = Database["public"]["Enums"]["note_visibility"];

export type Evaluation = {
  id: string;
  evaluation_date: string;
  period_start: string | null;
  period_end: string | null;
  overall_rating: Rating | null;
  listening_rating: Rating | null;
  speaking_rating: Rating | null;
  reading_rating: Rating | null;
  writing_rating: Rating | null;
  vocabulary_rating: Rating | null;
  grammar_rating: Rating | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  action_plan: string | null;
  teacher_comment: string | null;
  visible_to_student: boolean;
  published_at: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  created_at: string;
};

const RATINGS = Object.entries(EVALUATION_RATING_LABELS) as [Rating, string][];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function EvaluationProfile({
  enrollmentId,
  evaluations,
  notes,
}: {
  enrollmentId: string;
  evaluations: Evaluation[];
  notes: Note[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Đánh giá học tập</h2>
            <p className="text-muted-foreground text-sm">
              Lưu bản nháp trước; học viên chỉ thấy sau khi bạn bấm Gửi.
            </p>
          </div>
          <EvaluationDialog enrollmentId={enrollmentId} />
        </div>

        {evaluations.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Pencil}
                title="Chưa có đánh giá"
                description="Viết nhận xét theo kỳ: điểm mạnh, phần cần cải thiện và kế hoạch hành động."
              />
            </CardContent>
          </Card>
        ) : (
          evaluations.map((evaluation) => (
            <EvaluationCard
              key={evaluation.id}
              enrollmentId={enrollmentId}
              evaluation={evaluation}
            />
          ))
        )}
      </section>

      <NotesPanel enrollmentId={enrollmentId} notes={notes} />
    </div>
  );
}

function EvaluationCard({
  enrollmentId,
  evaluation,
}: {
  enrollmentId: string;
  evaluation: Evaluation;
}) {
  const isPublished = evaluation.published_at !== null;
  const ratings = RATING_FIELDS.filter((field) => evaluation[field.name]);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">
              Đánh giá {formatDate(evaluation.evaluation_date)}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {evaluation.period_start || evaluation.period_end
                ? `Kỳ ${formatDate(evaluation.period_start)} – ${formatDate(evaluation.period_end)}`
                : "Không đặt kỳ đánh giá"}
              {isPublished &&
                ` · Đã gửi ${formatDateTime(evaluation.published_at)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge
              label={isPublished ? "Học viên đã thấy" : "Nháp — chưa gửi"}
              tone={isPublished ? "success" : "neutral"}
            />
            <EvaluationDialog
              enrollmentId={enrollmentId}
              evaluation={evaluation}
            />
            {!isPublished && (
              <>
                <PublishEvaluationButton
                  enrollmentId={enrollmentId}
                  evaluation={evaluation}
                />
                <DeleteEvaluationButton
                  enrollmentId={enrollmentId}
                  evaluation={evaluation}
                />
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {ratings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ratings.map((field) => (
              <span
                key={field.name}
                className="bg-muted/50 rounded-md border px-2 py-1 text-xs"
              >
                {field.label}:{" "}
                <strong>
                  {EVALUATION_RATING_LABELS[evaluation[field.name] as Rating]}
                </strong>
              </span>
            ))}
          </div>
        )}

        <TextBlock label="Điểm mạnh" value={evaluation.strengths} />
        <TextBlock
          label="Cần cải thiện"
          value={evaluation.areas_for_improvement}
        />
        <TextBlock label="Kế hoạch hành động" value={evaluation.action_plan} />
        <TextBlock label="Nhận xét" value={evaluation.teacher_comment} />
      </CardContent>
    </Card>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function EvaluationDialog({
  enrollmentId,
  evaluation,
}: {
  enrollmentId: string;
  evaluation?: Evaluation;
}) {
  const [open, setOpen] = useState(false);
  const action = evaluation ? updateEvaluationAction : createEvaluationAction;
  const { state, formAction } = useFormAction(action, {
    onSuccess: () => setOpen(false),
  });
  const errors = state.fieldErrors ?? {};
  const id = evaluation?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {evaluation ? (
          <Button variant="ghost" size="icon" aria-label="Sửa đánh giá">
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            Viết đánh giá
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {evaluation ? "Sửa đánh giá" : "Viết đánh giá học tập"}
          </DialogTitle>
          <DialogDescription>
            Lưu form không gửi cho học viên. Gửi là một hành động riêng.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={enrollmentId} />
          {evaluation && (
            <input type="hidden" name="id" value={evaluation.id} />
          )}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`eval-date-${id}`}>Ngày đánh giá *</Label>
              <DatePicker
                id={`eval-date-${id}`}
                name="evaluation_date"
                defaultValue={
                  toDateInputValue(evaluation?.evaluation_date) ||
                  new Date().toISOString().slice(0, 10)
                }
                placeholder="Chọn ngày"
              />
              <FieldError message={errors["evaluation_date"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`eval-start-${id}`}>Kỳ từ</Label>
              <DatePicker
                id={`eval-start-${id}`}
                name="period_start"
                defaultValue={toDateInputValue(evaluation?.period_start)}
                placeholder="Chọn ngày"
              />
              <FieldError message={errors["period_start"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`eval-end-${id}`}>Kỳ đến</Label>
              <DatePicker
                id={`eval-end-${id}`}
                name="period_end"
                defaultValue={toDateInputValue(evaluation?.period_end)}
                placeholder="Chọn ngày"
              />
              <FieldError message={errors["period_end"]} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RATING_FIELDS.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`${field.name}-${id}`} className="text-xs">
                  {field.label}
                </Label>
                <Select
                  name={field.name}
                  defaultValue={evaluation?.[field.name] ?? "none"}
                >
                  <SelectTrigger
                    id={`${field.name}-${id}`}
                    className="w-full"
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Chưa đánh giá</SelectItem>
                    {RATINGS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {(
            [
              ["strengths", "Điểm mạnh"],
              ["areas_for_improvement", "Cần cải thiện"],
              ["action_plan", "Kế hoạch hành động"],
              ["teacher_comment", "Nhận xét chung"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`${name}-${id}`}>{label}</Label>
              <Textarea
                id={`${name}-${id}`}
                name={name}
                rows={2}
                maxLength={5000}
                defaultValue={evaluation?.[name] ?? ""}
              />
              <FieldError message={errors[name]} />
            </div>
          ))}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>
              {evaluation ? "Lưu thay đổi" : "Lưu bản nháp"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PublishEvaluationButton({
  enrollmentId,
  evaluation,
}: {
  enrollmentId: string;
  evaluation: Evaluation;
}) {
  const router = useRouter();
  const { formAction } = useFormAction(publishEvaluationAction, {
    toastError: true,
    onSuccess: () => router.refresh(),
  });
  const confirmPublish = useConfirmSubmit({
    title: "Gửi đánh giá cho học viên?",
    description:
      "Học viên sẽ đọc được bản đánh giá này và nhận thông báo trong hệ thống.",
    confirmLabel: "Gửi cho học viên",
  });

  return (
    <form action={formAction} onSubmit={confirmPublish}>
      <input type="hidden" name="id" value={evaluation.id} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <Button type="submit" size="sm">
        <Send className="size-4" aria-hidden />
        Gửi cho học viên
      </Button>
    </form>
  );
}

function DeleteEvaluationButton({
  enrollmentId,
  evaluation,
}: {
  enrollmentId: string;
  evaluation: Evaluation;
}) {
  const { formAction } = useFormAction(deleteEvaluationAction, {
    toastError: true,
  });
  const confirmDelete = useConfirmSubmit({
    title: "Xóa bản đánh giá nháp?",
    description: "Bản nháp này sẽ bị xóa và không thể khôi phục.",
    confirmLabel: "Xóa bản nháp",
    variant: "destructive",
  });

  return (
    <form action={formAction} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={evaluation.id} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Xóa đánh giá nháp"
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}

function NotesPanel({
  enrollmentId,
  notes,
}: {
  enrollmentId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const { state, formAction } = useFormAction(createNoteAction, {
    onSuccess: () => router.refresh(),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold">Ghi chú về học viên</h2>
        <p className="text-muted-foreground text-sm">
          Ghi chú <strong>nội bộ</strong> học viên không đọc được — kể cả khi
          gọi thẳng API. Ghi chú chia sẻ thì học viên đọc được ngay.
        </p>
      </div>

      <Card>
        <CardContent>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="enrollment_id" value={enrollmentId} />

            {state.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="note-body">Nội dung ghi chú</Label>
              <Textarea
                id="note-body"
                name="body"
                rows={3}
                required
                maxLength={5000}
                placeholder="Ghi nhận diễn biến, trao đổi với phụ huynh, lý do vắng…"
              />
              <FieldError message={errors["body"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-visibility">Ai đọc được?</Label>
              <Select name="visibility" defaultValue="staff_only">
                <SelectTrigger id="note-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff_only">
                    {NOTE_VISIBILITY_LABELS.staff_only}
                  </SelectItem>
                  <SelectItem value="student_visible">
                    {NOTE_VISIBILITY_LABELS.student_visible}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors["visibility"]} />
            </div>

            <SubmitButton className="w-full">Lưu ghi chú</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Lock}
              title="Chưa có ghi chú"
              description="Ghi chú nội bộ giúp bàn giao giữa giáo viên mà không lộ ra ngoài."
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} enrollmentId={enrollmentId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({ note, enrollmentId }: { note: Note; enrollmentId: string }) {
  const { formAction } = useFormAction(deleteNoteAction, { toastError: true });
  const confirmDelete = useConfirmSubmit({
    title: "Xóa ghi chú?",
    description: "Ghi chú này sẽ bị xóa và không thể khôi phục.",
    confirmLabel: "Xóa ghi chú",
    variant: "destructive",
  });
  const isInternal = note.visibility === "staff_only";

  return (
    <li>
      <Card className={isInternal ? "border-warning/40 bg-warning/5" : ""}>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge
              label={NOTE_VISIBILITY_LABELS[note.visibility]}
              tone={isInternal ? "warning" : "info"}
            />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {formatDateTime(note.created_at)}
              </span>
              <form action={formAction} onSubmit={confirmDelete}>
                <input type="hidden" name="id" value={note.id} />
                <input
                  type="hidden"
                  name="enrollment_id"
                  value={enrollmentId}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa ghi chú"
                >
                  <Trash2 className="text-destructive size-4" aria-hidden />
                </Button>
              </form>
            </div>
          </div>

          <p className="text-sm whitespace-pre-wrap">{note.body}</p>

          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {isInternal ? (
              <>
                <EyeOff className="size-3.5" aria-hidden />
                Học viên không đọc được ghi chú này.
              </>
            ) : (
              <>
                <Eye className="size-3.5" aria-hidden />
                Học viên đọc được ghi chú này.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </li>
  );
}
