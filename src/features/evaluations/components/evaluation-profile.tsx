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

/**
 * Thông báo lỗi của một ô nhập.
 *
 * `role="alert"` là phần bắt buộc, không phải trang trí: lỗi ở đây do server
 * action trả về SAU khi bấm Lưu, nên nếu không có vùng live thì người dùng
 * trình đọc màn hình bấm Lưu, không nghe thấy gì và tưởng đã lưu xong. `id` để
 * chính ô nhập trỏ tới bằng `aria-describedby` (tiền lệ `UX-UIUX-M27-*`).
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/**
 * Gắn `aria-invalid`/`aria-describedby` **chỉ khi thật sự có lỗi**.
 *
 * Gắn sẵn `aria-invalid="false"` cho mọi ô là sai kiểu khác: trình đọc màn hình
 * sẽ đọc trạng thái hợp lệ cho cả ô người dùng chưa hề đụng tới.
 */
function errorProps(id: string, message?: string) {
  return message ? { "aria-invalid": true, "aria-describedby": id } : {};
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
          // `<ul>/<li>` thật như panel ghi chú bên cạnh: trình đọc màn hình nói
          // được "danh sách 3 mục" thay vì đọc liền một khối không rõ ranh giới.
          <ul className="space-y-4">
            {evaluations.map((evaluation) => (
              <li key={evaluation.id}>
                <EvaluationCard
                  enrollmentId={enrollmentId}
                  evaluation={evaluation}
                />
              </li>
            ))}
          </ul>
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
  // Một hồ sơ có nhiều bản đánh giá, mỗi bản một cụm nút icon giống hệt nhau.
  // Ngày đánh giá là thứ phân biệt chúng ở trên màn hình, nên cũng phải là thứ
  // phân biệt chúng trong tên gọi được.
  const dateLabel = formatDate(evaluation.evaluation_date);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/*
              `CardTitle` mặc định là `<div>`. Hồ sơ xếp dọc nhiều bản đánh giá,
              không có heading thật thì trình đọc màn hình không nhảy được giữa
              các bản mà phải cuộn tuần tự qua toàn bộ nội dung. `<h3>` vì section
              bao ngoài đã là `<h2>` và trang đã là `<h1>`.
            */}
            <CardTitle asChild className="text-base">
              <h3>Đánh giá {dateLabel}</h3>
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
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
          <ul className="flex flex-wrap gap-2">
            {ratings.map((field) => (
              <li
                key={field.name}
                className="bg-muted/50 rounded-md border px-2 py-1 text-sm"
              >
                {field.label}:{" "}
                <strong>
                  {EVALUATION_RATING_LABELS[evaluation[field.name] as Rating]}
                </strong>
              </li>
            ))}
          </ul>
        )}

        {(evaluation.strengths ||
          evaluation.areas_for_improvement ||
          evaluation.action_plan ||
          evaluation.teacher_comment) && (
          <dl className="space-y-4">
            <TextBlock label="Điểm mạnh" value={evaluation.strengths} />
            <TextBlock
              label="Cần cải thiện"
              value={evaluation.areas_for_improvement}
            />
            <TextBlock
              label="Kế hoạch hành động"
              value={evaluation.action_plan}
            />
            <TextBlock label="Nhận xét" value={evaluation.teacher_comment} />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Một khối nội dung của bản đánh giá.
 *
 * `<dt>/<dd>` chứ không phải hai `<p>`: đây là cặp nhãn–giá trị, và trình đọc
 * màn hình cần biết "Điểm mạnh" là nhãn của đoạn ngay dưới nó chứ không phải
 * một câu độc lập (cùng cách M26/M27 đã làm cho khối thông tin).
 */
function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-sm whitespace-pre-wrap">{value}</dd>
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
  const dateLabel = evaluation ? formatDate(evaluation.evaluation_date) : "";
  const isPublished = evaluation?.published_at != null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {evaluation ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa đánh giá ${dateLabel}`}
          >
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
          {/*
            Câu này KHÁC NHAU theo trạng thái, không phải một câu dùng chung.
            `publish_evaluation` đã bật `visible_to_student`, và
            `updateEvaluationAction` sửa nội dung mà KHÔNG hạ cờ đó xuống — nên
            với bản đã gửi thì học viên đọc được bản sửa ngay. Dùng câu "không
            gửi cho học viên" ở đây là nói sai với giáo viên về hậu quả thao tác
            của họ (`P17-T3`). Chỉ sửa CÂU CHỮ, không đổi luật nghiệp vụ.
          */}
          <DialogDescription>
            {isPublished
              ? "Bản đánh giá này đã gửi rồi — học viên thấy thay đổi ngay khi bạn lưu."
              : "Lưu form không gửi cho học viên. Gửi là một hành động riêng."}
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
              {/*
                Dấu sao được nói ra thành chữ. Trình đọc màn hình đọc "*" thành
                "sao" hoặc bỏ qua hẳn tùy cấu hình, nên một mình nó không truyền
                đạt được "bắt buộc".
              */}
              <Label htmlFor={`eval-date-${id}`}>
                Ngày đánh giá <span aria-hidden>*</span>
                <span className="sr-only">(bắt buộc)</span>
              </Label>
              <DatePicker
                id={`eval-date-${id}`}
                name="evaluation_date"
                defaultValue={
                  toDateInputValue(evaluation?.evaluation_date) ||
                  new Date().toISOString().slice(0, 10)
                }
                placeholder="Chọn ngày"
                {...errorProps(
                  `eval-date-${id}-error`,
                  errors["evaluation_date"],
                )}
              />
              <FieldError
                id={`eval-date-${id}-error`}
                message={errors["evaluation_date"]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`eval-start-${id}`}>Kỳ từ</Label>
              <DatePicker
                id={`eval-start-${id}`}
                name="period_start"
                defaultValue={toDateInputValue(evaluation?.period_start)}
                placeholder="Chọn ngày"
                {...errorProps(
                  `eval-start-${id}-error`,
                  errors["period_start"],
                )}
              />
              <FieldError
                id={`eval-start-${id}-error`}
                message={errors["period_start"]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`eval-end-${id}`}>Kỳ đến</Label>
              <DatePicker
                id={`eval-end-${id}`}
                name="period_end"
                defaultValue={toDateInputValue(evaluation?.period_end)}
                placeholder="Chọn ngày"
                {...errorProps(`eval-end-${id}-error`, errors["period_end"])}
              />
              <FieldError
                id={`eval-end-${id}-error`}
                message={errors["period_end"]}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RATING_FIELDS.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`${field.name}-${id}`}>{field.label}</Label>
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
                {...errorProps(`${name}-${id}-error`, errors[name])}
              />
              <FieldError id={`${name}-${id}-error`} message={errors[name]} />
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
      {/*
        Tên gọi được vẫn CHỨA nguyên chữ nhìn thấy ("Gửi cho học viên") nên
        không phạm WCAG 2.5.3, mà vẫn phân biệt được khi hồ sơ có nhiều bản nháp.
      */}
      <Button
        type="submit"
        size="sm"
        aria-label={`Gửi cho học viên bản đánh giá ${formatDate(evaluation.evaluation_date)}`}
      >
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
        aria-label={`Xóa đánh giá nháp ${formatDate(evaluation.evaluation_date)}`}
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
                aria-invalid={errors["body"] ? true : undefined}
                /*
                 * Trỏ tới CẢ gợi ý lẫn lỗi. Nếu lúc có lỗi mà chỉ trỏ vào lỗi
                 * thì người dùng trình đọc màn hình mất luôn câu "tối thiểu 3
                 * ký tự" — đúng lúc họ cần nó nhất.
                 */
                aria-describedby={
                  errors["body"]
                    ? "note-body-hint note-body-error"
                    : "note-body-hint"
                }
              />
              {/* Nói ra luật của schema thay vì để người dùng bấm Lưu rồi mới biết. */}
              <p id="note-body-hint" className="text-muted-foreground text-sm">
                Tối thiểu 3 ký tự, tối đa 5.000 ký tự.
              </p>
              <FieldError id="note-body-error" message={errors["body"]} />
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
              <FieldError
                id="note-visibility-error"
                message={errors["visibility"]}
              />
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
              <span className="text-muted-foreground text-sm">
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
                  aria-label={`Xóa ghi chú ${formatDateTime(note.created_at)}`}
                >
                  <Trash2 className="text-destructive size-4" aria-hidden />
                </Button>
              </form>
            </div>
          </div>

          <p className="text-sm whitespace-pre-wrap">{note.body}</p>

          {/*
            Câu này là hàng rào cuối cùng chống nhầm lẫn "tưởng nội bộ hóa ra
            chia sẻ". Nó phải đọc được, không phải chú thích mờ 12px — và không
            được chỉ dựa vào màu viền của card (`color-not-only`).
          */}
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            {isInternal ? (
              <>
                <EyeOff className="size-4 shrink-0" aria-hidden />
                Học viên không đọc được ghi chú này.
              </>
            ) : (
              <>
                <Eye className="size-4 shrink-0" aria-hidden />
                Học viên đọc được ghi chú này.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </li>
  );
}
