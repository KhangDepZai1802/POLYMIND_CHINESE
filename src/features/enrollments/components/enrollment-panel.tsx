"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  History,
  UserPlus,
  Users,
} from "lucide-react";

import {
  changeEnrollmentStatusAction,
  enrollStudentAction,
  transferEnrollmentAction,
} from "@/features/enrollments/server/actions";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  ENROLLMENT_ACTION_LABELS,
  allowedEnrollmentTransitions,
  canTransferEnrollment,
  isOpenEnrollment,
  type EnrollmentStatus,
} from "@/lib/domain/enrollment";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONE,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";

type HistoryRow = {
  id: string;
  old_status: EnrollmentStatus | null;
  new_status: EnrollmentStatus;
  reason: string | null;
  changed_at: string;
};

type Enrollment = {
  id: string;
  status: EnrollmentStatus;
  enrolled_on: string;
  started_on: string | null;
  ended_on: string | null;
  reason: string | null;
  student: {
    id: string;
    student_code: string;
    full_name: string;
    phone: string | null;
  } | null;
  enrollment_status_history: HistoryRow[];
};

type StudentOption = { id: string; student_code: string; full_name: string };
type ClassTarget = {
  id: string;
  code: string;
  name: string;
  taken: number;
  capacity: number;
};

export function EnrollmentPanel({
  classId,
  capacity,
  enrollments,
  enrollableStudents,
  transferTargets,
}: {
  classId: string;
  capacity: number;
  enrollments: Enrollment[];
  enrollableStudents: StudentOption[];
  transferTargets: ClassTarget[];
}) {
  const open = enrollments.filter((e) => isOpenEnrollment(e.status));
  const closed = enrollments.filter((e) => !isOpenEnrollment(e.status));
  const isFull = open.length >= capacity;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            Học viên ({open.length}/{capacity})
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Chỉ ghi danh đang mở mới chiếm chỗ. Ghi danh đã đóng vẫn nằm lại đây
            như lịch sử.
          </p>
        </div>
        <EnrollDialog
          classId={classId}
          students={enrollableStudents}
          isFull={isFull}
        />
      </CardHeader>

      <CardContent className="p-0">
        {enrollments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có học viên nào"
            description="Ghi danh học viên đầu tiên vào lớp này."
          />
        ) : (
          <ul className="divide-y border-t">
            {[...open, ...closed].map((e) => (
              <EnrollmentRow
                key={e.id}
                classId={classId}
                enrollment={e}
                transferTargets={transferTargets}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EnrollmentRow({
  classId,
  enrollment,
  transferTargets,
}: {
  classId: string;
  enrollment: Enrollment;
  transferTargets: ClassTarget[];
}) {
  const transitions = allowedEnrollmentTransitions(enrollment.status);
  const canTransfer = canTransferEnrollment(enrollment.status);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {enrollment.student?.full_name ?? "Học viên"}
            </p>
            <StatusBadge
              label={ENROLLMENT_STATUS_LABELS[enrollment.status]}
              tone={ENROLLMENT_STATUS_TONE[enrollment.status]}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {enrollment.student?.student_code} · Ghi danh{" "}
            {formatDate(enrollment.enrolled_on)}
            {enrollment.ended_on
              ? ` · Kết thúc ${formatDate(enrollment.ended_on)}`
              : ""}
          </p>
          {enrollment.reason && (
            <p className="text-muted-foreground mt-1 text-xs italic">
              “{enrollment.reason}”
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {transitions.map((next) => (
            <StatusChangeDialog
              key={next}
              classId={classId}
              enrollment={enrollment}
              nextStatus={next}
            />
          ))}

          {canTransfer && (
            <TransferDialog
              classId={classId}
              enrollment={enrollment}
              targets={transferTargets}
            />
          )}

          <HistoryDialog enrollment={enrollment} />
        </div>
      </div>
    </li>
  );
}

/**
 * Đổi trạng thái — luôn hỏi lý do.
 *
 * Lý do không phải thủ tục hành chính: sáu tháng sau, câu hỏi "vì sao học viên
 * này bị rút khỏi lớp" phải trả lời được từ chính hệ thống, không phải từ trí
 * nhớ của người đã nghỉ việc. Nó được ghi vào `enrollment_status_history`
 * (append-only) trong cùng transaction với việc đổi trạng thái.
 */
function StatusChangeDialog({
  classId,
  enrollment,
  nextStatus,
}: {
  classId: string;
  enrollment: Enrollment;
  nextStatus: EnrollmentStatus;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(changeEnrollmentStatusAction, {
    onSuccess: () => setOpen(false),
  });

  const isDestructive = nextStatus === "withdrawn";
  const label = ENROLLMENT_ACTION_LABELS[nextStatus];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isDestructive ? "outline" : "ghost"} size="sm">
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {enrollment.student?.full_name} ·{" "}
            {ENROLLMENT_STATUS_LABELS[enrollment.status]} →{" "}
            {ENROLLMENT_STATUS_LABELS[nextStatus]}
            {nextStatus === "withdrawn" || nextStatus === "completed"
              ? ". Đây là trạng thái cuối, không quay lại được — học viên sẽ được ghi danh lớp khác."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={enrollment.id} />
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="new_status" value={nextStatus} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`reason-${enrollment.id}-${nextStatus}`}>
              Lý do
            </Label>
            <Textarea
              id={`reason-${enrollment.id}-${nextStatus}`}
              name="reason"
              rows={3}
              placeholder="Ghi lại để sau này còn tra được vì sao."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>{label}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  classId,
  enrollment,
  targets,
}: {
  classId: string;
  enrollment: Enrollment;
  targets: ClassTarget[];
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(transferEnrollmentAction, {
    onSuccess: () => setOpen(false),
  });

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <ArrowRightLeft className="size-4" aria-hidden />
          Chuyển lớp
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển lớp</DialogTitle>
          <DialogDescription>
            {enrollment.student?.full_name}. Ghi danh ở lớp hiện tại được đánh
            dấu <strong>đã chuyển</strong> chứ không bị xóa — điểm và điểm danh
            cũ ở lại lớp cũ.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={enrollment.id} />
          <input type="hidden" name="class_id" value={classId} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {targets.length === 0 ? (
            <Alert>
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>
                Không có lớp nào còn chỗ để chuyển đến.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`to-${enrollment.id}`}>Lớp đích *</Label>
              <Select name="to_class_id">
                <SelectTrigger id={`to-${enrollment.id}`} className="w-full">
                  <SelectValue placeholder="Chọn lớp còn chỗ" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} — {t.name} ({t.taken}/{t.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fe["to_class_id"]} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`transfer-reason-${enrollment.id}`}>Lý do</Label>
            <Textarea
              id={`transfer-reason-${enrollment.id}`}
              name="reason"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton disabled={targets.length === 0}>
              Chuyển lớp
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ enrollment }: { enrollment: Enrollment }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Lịch sử của ${enrollment.student?.full_name ?? "học viên"}`}
        >
          <History className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lịch sử ghi danh</DialogTitle>
          <DialogDescription>
            {enrollment.student?.full_name} · Sổ ghi chỉ thêm, không sửa, không
            xóa.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {enrollment.enrollment_status_history.map((h) => (
            <li key={h.id} className="border-l-2 pl-3">
              <p className="text-sm font-medium">
                {h.old_status
                  ? `${ENROLLMENT_STATUS_LABELS[h.old_status]} → ${ENROLLMENT_STATUS_LABELS[h.new_status]}`
                  : `Tạo ghi danh — ${ENROLLMENT_STATUS_LABELS[h.new_status]}`}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(h.changed_at)}
              </p>
              {h.reason && (
                <p className="mt-1 text-sm italic">“{h.reason}”</p>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function EnrollDialog({
  classId,
  students,
  isFull,
}: {
  classId: string;
  students: StudentOption[];
  isFull: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(enrollStudentAction, {
    onSuccess: () => setOpen(false),
  });

  const fe = state.fieldErrors ?? {};
  const blocked = isFull || students.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={blocked}
          // Nút khóa mà không nói vì sao thì người dùng tưởng hệ thống hỏng.
          title={
            isFull
              ? "Lớp đã đủ sĩ số"
              : students.length === 0
                ? "Không còn học viên nào rảnh: mỗi học viên chỉ học một lớp tại một thời điểm"
                : undefined
          }
        >
          <UserPlus className="size-4" aria-hidden />
          Ghi danh
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi danh học viên</DialogTitle>
          <DialogDescription>
            Chỉ hiện học viên <strong>chưa có lớp nào đang mở</strong>: mỗi học
            viên chỉ học một lớp tại một thời điểm.
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
            <Label htmlFor="student_id">Học viên *</Label>
            <Select name="student_id">
              <SelectTrigger id="student_id" className="w-full">
                <SelectValue placeholder="Chọn học viên" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.student_code} — {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={fe["student_id"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enroll_status">Trạng thái *</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger id="enroll_status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  {ENROLLMENT_STATUS_LABELS.active} — vào học ngay
                </SelectItem>
                <SelectItem value="pending">
                  {ENROLLMENT_STATUS_LABELS.pending} — giữ chỗ, chưa vào học
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={fe["status"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enroll_reason">Ghi chú</Label>
            <Textarea id="enroll_reason" name="reason" rows={2} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Ghi danh</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}
