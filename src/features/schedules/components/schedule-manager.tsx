"use client";

import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  Plus,
  Repeat,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";

import {
  cancelSessionAction,
  createManualSessionAction,
  createScheduleAction,
  deleteScheduleAction,
  deleteSessionAction,
  generateSessionsAction,
} from "@/features/schedules/server/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { ActionState } from "@/lib/action-state";
import {
  WEEKDAYS,
  formatClock,
  formatDate,
  formatDateTime,
  weekdayLabel,
} from "@/lib/dates";
import { SESSION_STATUS_LABELS, SESSION_STATUS_TONE } from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";

type SessionStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

type Schedule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  effective_from: string | null;
  effective_to: string | null;
};

type Session = {
  id: string;
  session_number: number;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
  topic: string | null;
  lesson: { id: string; title: string } | null;
};

type LessonOption = { id: string; label: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

export function ScheduleManager({
  classId,
  plannedSessionCount,
  hasStartDate,
  schedules,
  sessions,
  lessons,
}: {
  classId: string;
  plannedSessionCount: number | null;
  hasStartDate: boolean;
  schedules: Schedule[];
  sessions: Session[];
  lessons: LessonOption[];
}) {
  const isFlexible = schedules.length === 0;
  const generated = sessions.length;

  // Lớp chưa chốt số buổi / ngày khai giảng thì RPC sẽ từ chối — nói trước cho
  // admin thay vì để họ bấm rồi ăn lỗi đỏ.
  const blockedReason = !hasStartDate
    ? "Lớp chưa có ngày khai giảng."
    : plannedSessionCount === null
      ? "Lớp chưa chốt số buổi dự kiến."
      : null;

  return (
    <div className="space-y-5">
      {/* --- Lịch lặp --- */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Lịch lặp</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Khuôn để sinh buổi học: thứ mấy, mấy giờ. Sửa khuôn{" "}
              <strong>không</strong> làm đổi các buổi đã sinh.
            </p>
          </div>
          <ScheduleDialog classId={classId} />
        </CardHeader>

        <CardContent className="p-0">
          {isFlexible ? (
            <div className="border-t px-5 py-4">
              <p className="text-sm font-medium">Lớp linh hoạt — không có lịch lặp</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Đây là trạng thái <strong>hợp lệ</strong>, không phải thiếu dữ
                liệu: có lớp học theo lịch do khách hàng chốt từng buổi. Thêm
                từng buổi ở phần “Buổi học” bên dưới.
              </p>
            </div>
          ) : (
            <ul className="divide-y border-t">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <Repeat
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {weekdayLabel(s.weekday)} · {formatClock(s.start_time)}–
                      {formatClock(s.end_time)}
                    </p>
                    {(s.effective_from || s.effective_to) && (
                      <p className="text-muted-foreground text-xs">
                        Áp dụng {formatDate(s.effective_from)} →{" "}
                        {formatDate(s.effective_to)}
                      </p>
                    )}
                  </div>
                  <DeleteScheduleButton
                    id={s.id}
                    classId={classId}
                    label={`${weekdayLabel(s.weekday)} ${formatClock(s.start_time)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* --- Sinh buổi học --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sinh buổi học</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Đã sinh <strong>{generated}</strong>
            {plannedSessionCount ? `/${plannedSessionCount}` : ""} buổi. Bấm nhiều
            lần không sinh trùng — chống trùng bằng ràng buộc ở DB.
          </p>
        </CardHeader>
        <CardContent>
          {blockedReason ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>
                {blockedReason} Vào “Sửa lớp” bổ sung trước khi sinh buổi.
              </AlertDescription>
            </Alert>
          ) : (
            <GenerateButton classId={classId} disabled={isFlexible} />
          )}
        </CardContent>
      </Card>

      {/* --- Buổi học --- */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Buổi học ({generated})</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Giờ hiển thị theo múi giờ Việt Nam.
            </p>
          </div>
          <ManualSessionDialog classId={classId} lessons={lessons} />
        </CardHeader>

        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Chưa có buổi học nào"
              description={
                isFlexible
                  ? "Lớp linh hoạt: thêm từng buổi bằng nút “Thêm buổi”."
                  : "Bấm “Sinh buổi học” để tạo buổi từ lịch lặp."
              }
            />
          ) : (
            <ul className="divide-y border-t">
              {sessions.map((s) => (
                <SessionRow key={s.id} classId={classId} session={s} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionRow({
  classId,
  session,
}: {
  classId: string;
  session: Session;
}) {
  // Buổi đã dạy: không cho xóa ở UI, và DB cũng chặn (migration 22). Ẩn nút chỉ
  // là lịch sự — chốt chặn thật nằm ở trigger.
  const canDelete = session.status === "scheduled";
  const canCancel = session.status === "scheduled";

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded text-xs font-semibold">
        {session.session_number}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            {formatDateTime(session.starts_at)}
          </p>
          <StatusBadge
            label={SESSION_STATUS_LABELS[session.status]}
            tone={SESSION_STATUS_TONE[session.status]}
          />
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {session.lesson?.title ?? session.topic ?? "Chưa gắn bài học"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canCancel && (
          <SessionActionButton
            action={cancelSessionAction}
            id={session.id}
            classId={classId}
            icon={<XCircle className="size-4" aria-hidden />}
            label={`Hủy buổi ${session.session_number}`}
            confirmMessage={`Hủy buổi ${session.session_number}? Buổi vẫn được giữ trong lịch sử.`}
          />
        )}
        {canDelete && (
          <SessionActionButton
            action={deleteSessionAction}
            id={session.id}
            classId={classId}
            icon={<Trash2 className="text-destructive size-4" aria-hidden />}
            label={`Xóa buổi ${session.session_number}`}
            confirmMessage={`Xóa hẳn buổi ${session.session_number}? Chỉ dùng khi sinh nhầm — buổi đã điểm danh sẽ bị DB từ chối.`}
          />
        )}
      </div>
    </li>
  );
}

function SessionActionButton({
  action,
  id,
  classId,
  icon,
  label,
  confirmMessage,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  classId: string;
  icon: React.ReactNode;
  label: string;
  confirmMessage: string;
}) {
  const { formAction } = useFormAction(action, { toastError: true });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="class_id" value={classId} />
      <Button type="submit" variant="ghost" size="icon" aria-label={label}>
        {icon}
      </Button>
    </form>
  );
}

function GenerateButton({
  classId,
  disabled,
}: {
  classId: string;
  disabled: boolean;
}) {
  const { formAction } = useFormAction(generateSessionsAction, {
    toastError: true,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="class_id" value={classId} />
      <SubmitButton disabled={disabled}>
        <Wand2 className="size-4" aria-hidden />
        Sinh buổi học
      </SubmitButton>
      {disabled && (
        <p className="text-muted-foreground mt-2 text-xs">
          Lớp chưa có lịch lặp — không có khuôn nào để sinh. Thêm lịch lặp, hoặc
          thêm buổi thủ công nếu đây là lớp linh hoạt.
        </p>
      )}
    </form>
  );
}

function DeleteScheduleButton({
  id,
  classId,
  label,
}: {
  id: string;
  classId: string;
  label: string;
}) {
  const { formAction } = useFormAction(deleteScheduleAction, {
    toastError: true,
  });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Xóa lịch lặp "${label}"? Các buổi đã sinh từ lịch này vẫn được giữ nguyên.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="class_id" value={classId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Xóa lịch lặp ${label}`}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}

function ScheduleDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(createScheduleAction, {
    onSuccess: () => setOpen(false),
  });

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" aria-hidden />
          Thêm lịch lặp
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm lịch lặp</DialogTitle>
          <DialogDescription>
            Ví dụ: Thứ Ba, 18:00–20:00. Buổi học sẽ được sinh từ khuôn này.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="class_id" value={classId} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="weekday">Thứ *</Label>
            <Select name="weekday" defaultValue="2">
              <SelectTrigger id="weekday" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((w) => (
                  <SelectItem key={w.value} value={String(w.value)}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={fe["weekday"]} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Giờ bắt đầu *</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                required
                defaultValue="18:00"
              />
              <FieldError message={fe["start_time"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Giờ kết thúc *</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                required
                defaultValue="20:00"
              />
              <FieldError message={fe["end_time"]} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effective_from">Áp dụng từ</Label>
              <Input id="effective_from" name="effective_from" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_to">Áp dụng đến</Label>
              <Input id="effective_to" name="effective_to" type="date" />
              <FieldError message={fe["effective_to"]} />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Để trống nếu lịch áp dụng suốt khóa. Dùng khi lớp đổi khung giờ giữa
            chừng.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Thêm lịch</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManualSessionDialog({
  classId,
  lessons,
}: {
  classId: string;
  lessons: LessonOption[];
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(createManualSessionAction, {
    onSuccess: () => setOpen(false),
  });

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="size-4" aria-hidden />
          Thêm buổi
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm buổi học</DialogTitle>
          <DialogDescription>
            Dùng cho lớp linh hoạt (không có lịch lặp) hoặc buổi học bù. Nhập giờ
            Việt Nam.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="class_id" value={classId} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="starts_at">Bắt đầu *</Label>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
            />
            <FieldError message={fe["starts_at"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ends_at">Kết thúc *</Label>
            <Input id="ends_at" name="ends_at" type="datetime-local" required />
            <FieldError message={fe["ends_at"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson_id">Bài học</Label>
            <Select name="lesson_id" defaultValue="none">
              <SelectTrigger id="lesson_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Chưa gắn bài học</SelectItem>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Nội dung dự kiến</Label>
            <Textarea id="topic" name="topic" rows={2} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Thêm buổi</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
