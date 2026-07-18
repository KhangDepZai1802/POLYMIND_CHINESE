"use client";

import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plus,
  Repeat,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";

import {
  formatCalendarDay,
  formatCalendarPeriod,
  getMonthGridDateKeys,
  getWeekDateKeys,
  monthKey,
  pickInitialDateKey,
  shiftCalendarAnchor,
  type CalendarView,
} from "@/features/schedules/calendar";
import {
  cancelSessionAction,
  createManualSessionAction,
  createScheduleAction,
  deleteAllSessionsAction,
  deleteScheduleAction,
  deleteSessionAction,
  generateSessionsAction,
} from "@/features/schedules/server/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { useConfirmSubmit } from "@/components/shared/confirmation-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  dateKeyInVN,
  formatClock,
  formatDate,
  formatDateTime,
  formatTime,
  todayISO,
  weekdayLabel,
} from "@/lib/dates";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONE,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";

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
              <p className="text-sm font-medium">
                Lớp linh hoạt — không có lịch lặp
              </p>
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
            {plannedSessionCount ? `/${plannedSessionCount}` : ""} buổi. Bấm
            nhiều lần không sinh trùng — chống trùng bằng ràng buộc ở DB.
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
          <div className="flex shrink-0 items-center gap-2">
            {generated > 0 && <DeleteAllSessionsButton classId={classId} />}
            <ManualSessionDialog classId={classId} lessons={lessons} />
          </div>
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
            <SessionCalendar classId={classId} sessions={sessions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionCalendar({
  classId,
  sessions,
}: {
  classId: string;
  sessions: Session[];
}) {
  const currentDateKey = todayISO();
  const [view, setView] = useState<CalendarView>("week");
  const [anchorKey, setAnchorKey] = useState(() =>
    pickInitialDateKey(
      sessions.map((session) => dateKeyInVN(session.starts_at)),
      currentDateKey,
    ),
  );

  const sessionsByDate = new Map<string, Session[]>();
  for (const session of sessions) {
    const dateKey = dateKeyInVN(session.starts_at);
    const dateSessions = sessionsByDate.get(dateKey) ?? [];
    dateSessions.push(session);
    sessionsByDate.set(dateKey, dateSessions);
  }
  for (const dateSessions of sessionsByDate.values()) {
    dateSessions.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  const move = (amount: number) => {
    if (view === "compact") return;
    setAnchorKey((current) => shiftCalendarAnchor(current, view, amount));
  };

  return (
    <div className="border-t">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="bg-muted inline-flex w-fit rounded-lg p-1"
          role="group"
          aria-label="Kiểu hiển thị thời khóa biểu"
        >
          <ViewButton
            active={view === "compact"}
            icon={<List className="size-4" aria-hidden />}
            label="Tối giản"
            onClick={() => setView("compact")}
          />
          <ViewButton
            active={view === "week"}
            icon={<CalendarRange className="size-4" aria-hidden />}
            label="Tuần"
            onClick={() => setView("week")}
          />
          <ViewButton
            active={view === "month"}
            icon={<CalendarDays className="size-4" aria-hidden />}
            label="Tháng"
            onClick={() => setView("month")}
          />
        </div>

        {view !== "compact" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => move(-1)}
              aria-label={
                view === "week" ? "Xem tuần trước" : "Xem tháng trước"
              }
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <p
              className="min-w-40 text-center text-sm font-semibold"
              aria-live="polite"
            >
              {formatCalendarPeriod(anchorKey, view)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => move(1)}
              aria-label={view === "week" ? "Xem tuần sau" : "Xem tháng sau"}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setAnchorKey(currentDateKey)}
            >
              Hôm nay
            </Button>
          </div>
        )}
      </div>

      {view === "compact" && (
        <ul className="divide-y border-t">
          {sessions.map((session) => (
            <SessionRow key={session.id} classId={classId} session={session} />
          ))}
        </ul>
      )}

      {view === "week" && (
        <WeekCalendar
          classId={classId}
          anchorKey={anchorKey}
          currentDateKey={currentDateKey}
          sessionsByDate={sessionsByDate}
        />
      )}

      {view === "month" && (
        <MonthCalendar
          anchorKey={anchorKey}
          currentDateKey={currentDateKey}
          sessionsByDate={sessionsByDate}
        />
      )}
    </div>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="min-h-11"
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

function WeekCalendar({
  classId,
  anchorKey,
  currentDateKey,
  sessionsByDate,
}: {
  classId: string;
  anchorKey: string;
  currentDateKey: string;
  sessionsByDate: Map<string, Session[]>;
}) {
  const days = getWeekDateKeys(anchorKey);

  return (
    <div className="overflow-x-auto border-t">
      <div className="grid min-w-[840px] grid-cols-7">
        {days.map((dateKey, index) => {
          const dateSessions = sessionsByDate.get(dateKey) ?? [];
          const isToday = dateKey === currentDateKey;

          return (
            <section
              key={dateKey}
              className="min-h-80 border-l first:border-l-0"
              aria-label={`${WEEKDAYS[index]?.label}, ${formatCalendarDay(dateKey, "dd/MM/yyyy")}`}
            >
              <div
                className={cn(
                  "border-b px-3 py-2 text-center",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                <p className="text-xs font-medium uppercase">
                  {WEEKDAYS[index]?.short}
                </p>
                <p className="mt-0.5 text-lg font-semibold">
                  {formatCalendarDay(dateKey, "dd")}
                </p>
              </div>
              <div className="space-y-2 p-2">
                {dateSessions.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    Không có buổi học
                  </p>
                ) : (
                  dateSessions.map((session) => (
                    <WeekSessionCard
                      key={session.id}
                      classId={classId}
                      session={session}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WeekSessionCard({
  classId,
  session,
}: {
  classId: string;
  session: Session;
}) {
  return (
    <article
      className={cn(
        "bg-card rounded-lg border p-2 shadow-sm",
        session.status === "cancelled" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1 text-xs font-semibold">
        <Clock3 className="size-3.5" aria-hidden />
        {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
      </div>
      <p className="mt-1 text-sm font-semibold">
        Buổi {session.session_number}
      </p>
      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
        {session.lesson?.title ?? session.topic ?? "Chưa gắn bài học"}
      </p>
      <div className="mt-2 flex items-end justify-between gap-1">
        <StatusBadge
          label={SESSION_STATUS_LABELS[session.status]}
          tone={SESSION_STATUS_TONE[session.status]}
        />
        <SessionActions classId={classId} session={session} />
      </div>
    </article>
  );
}

function MonthCalendar({
  anchorKey,
  currentDateKey,
  sessionsByDate,
}: {
  anchorKey: string;
  currentDateKey: string;
  sessionsByDate: Map<string, Session[]>;
}) {
  const days = getMonthGridDateKeys(anchorKey);
  const activeMonth = monthKey(anchorKey);

  return (
    <div className="overflow-x-auto border-t">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday.value}
              className="border-l px-2 py-2 text-center text-xs font-semibold first:border-l-0"
            >
              {weekday.label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((dateKey) => {
            const dateSessions = sessionsByDate.get(dateKey) ?? [];
            const isToday = dateKey === currentDateKey;
            const isOutside = monthKey(dateKey) !== activeMonth;

            return (
              <section
                key={dateKey}
                className={cn(
                  "min-h-32 border-b border-l p-2 first:border-l-0",
                  isOutside && "bg-muted/30 text-muted-foreground",
                )}
                aria-label={formatCalendarDay(dateKey, "dd/MM/yyyy")}
              >
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {formatCalendarDay(dateKey, "d")}
                </span>
                <div className="mt-1 space-y-1">
                  {dateSessions.slice(0, 3).map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "bg-primary/10 text-primary truncate rounded px-1.5 py-1 text-xs font-medium",
                        session.status === "cancelled" &&
                          "bg-muted text-muted-foreground line-through",
                      )}
                      title={`Buổi ${session.session_number} · ${SESSION_STATUS_LABELS[session.status]}`}
                    >
                      {formatTime(session.starts_at)} · Buổi{" "}
                      {session.session_number}
                    </div>
                  ))}
                  {dateSessions.length > 3 && (
                    <p className="text-muted-foreground px-1 text-xs">
                      +{dateSessions.length - 3} buổi khác
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
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

      <SessionActions classId={classId} session={session} />
    </li>
  );
}

function SessionActions({
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
  const confirmAction = useConfirmSubmit({
    title: "Xác nhận thao tác",
    description: confirmMessage,
    confirmLabel: label,
    variant: "destructive",
  });

  return (
    <form action={formAction} onSubmit={confirmAction}>
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

function DeleteAllSessionsButton({ classId }: { classId: string }) {
  const { formAction } = useFormAction(deleteAllSessionsAction, {
    toastError: true,
  });
  const confirmDeleteAll = useConfirmSubmit({
    title: "Xóa tất cả buổi chưa dạy?",
    description:
      "Buổi đã dạy hoặc đã điểm danh sẽ được giữ lại. Các buổi chưa dạy sẽ bị xóa.",
    confirmLabel: "Xóa tất cả",
    variant: "destructive",
  });

  return (
    <form action={formAction} onSubmit={confirmDeleteAll}>
      <input type="hidden" name="class_id" value={classId} />
      <Button type="submit" variant="outline" size="sm">
        <Trash2 className="text-destructive size-4" aria-hidden />
        Xóa tất cả
      </Button>
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
  const confirmDelete = useConfirmSubmit({
    title: `Xóa lịch lặp “${label}”?`,
    description: "Các buổi đã sinh từ lịch này vẫn được giữ nguyên.",
    confirmLabel: "Xóa lịch lặp",
    variant: "destructive",
  });

  return (
    <form action={formAction} onSubmit={confirmDelete}>
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
              <DatePicker
                id="effective_from"
                name="effective_from"
                placeholder="Chọn ngày"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_to">Áp dụng đến</Label>
              <DatePicker
                id="effective_to"
                name="effective_to"
                placeholder="Chọn ngày"
              />
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
            Dùng cho lớp linh hoạt (không có lịch lặp) hoặc buổi học bù. Nhập
            giờ Việt Nam.
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
            <DateTimePicker
              id="starts_at"
              name="starts_at"
              placeholder="Chọn ngày giờ"
            />
            <FieldError message={fe["starts_at"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ends_at">Kết thúc *</Label>
            <DateTimePicker
              id="ends_at"
              name="ends_at"
              placeholder="Chọn ngày giờ"
            />
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
