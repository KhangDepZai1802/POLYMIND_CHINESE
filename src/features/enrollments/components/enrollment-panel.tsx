"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  History,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
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

/**
 * Số hàng hiện sẵn trước khi phải bấm "Xem thêm".
 *
 * Lớp 40 học viên với thẻ cũ (mỗi hàng ~130px vì 4 nút thao tác trải ngang rồi
 * xuống dòng) đẩy trang dài **hơn 5.000px** — cột trái đã hết nội dung từ lâu mà
 * người dùng vẫn còn cuộn. Chặn ở 8 hàng × ~52px giữ cả thẻ dưới ~500px, tức
 * hai cột kết thúc gần cùng chỗ. Chọn "xem thêm" chứ KHÔNG chọn vùng cuộn lồng
 * (`max-h` + `overflow-y-auto`): trên điện thoại vùng cuộn lồng nuốt mất cú
 * vuốt của trang, người dùng bị kẹt trong danh sách.
 */
const VISIBLE_LIMIT = 8;

/** Icon cho từng hành động — menu chữ không thôi thì mắt phải đọc hết mới chọn được. */
const ACTION_ICONS: Record<EnrollmentStatus, LucideIcon> = {
  pending: Clock,
  active: Play,
  paused: Pause,
  completed: CheckCircle2,
  withdrawn: UserMinus,
  transferred: ArrowRightLeft,
};

/**
 * Bỏ dấu để gõ "dung" tìm ra "Dũng", "hv31" tìm ra "HV000031".
 * NFD tách chữ khỏi dấu thanh rồi xóa dải `U+0300…U+036F`; `đ/Đ` phải xử riêng
 * vì NFD không tách được (cùng cách `lib/domain/files.ts` đang làm).
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

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
  const [scope, setScope] = useState<"open" | "closed">("open");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { open, closed } = useMemo(() => {
    const openRows: Enrollment[] = [];
    const closedRows: Enrollment[] = [];
    for (const e of enrollments) {
      (isOpenEnrollment(e.status) ? openRows : closedRows).push(e);
    }
    return { open: openRows, closed: closedRows };
  }, [enrollments]);

  const isFull = open.length >= capacity;
  const source = scope === "open" ? open : closed;

  const needle = fold(query.trim());
  const matched = needle
    ? source.filter((e) =>
        fold(
          `${e.student?.full_name ?? ""} ${e.student?.student_code ?? ""} ${e.student?.phone ?? ""}`,
        ).includes(needle),
      )
    : source;

  const visible = expanded ? matched : matched.slice(0, VISIBLE_LIMIT);
  const hiddenCount = matched.length - visible.length;

  // Đổi bộ lọc hay gõ tìm kiếm thì thu gọn lại: mở sẵn 40 hàng cho một kết quả
  // tìm kiếm 2 hàng là trả người dùng về đúng chỗ họ vừa thoát ra.
  const changeScope = (next: "open" | "closed") => {
    setScope(next);
    setExpanded(false);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    setExpanded(false);
  };

  const fillPercent =
    capacity > 0 ? Math.min(100, Math.round((open.length / capacity) * 100)) : 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle asChild className="text-base">
              <h2>Học viên</h2>
            </CardTitle>
            <p className="text-text-secondary mt-0.5 text-sm">
              <span className="text-foreground font-medium tabular-nums">
                {open.length}/{capacity}
              </span>{" "}
              chỗ đang dùng
              {closed.length > 0 && ` · ${closed.length} ghi danh đã đóng`}
            </p>
          </div>
          <EnrollDialog
            classId={classId}
            students={enrollableStudents}
            isFull={isFull}
          />
        </div>

        {/* Thanh sức chứa: `aria-hidden` vì con số "31/40" ngay trên đã nói đủ —
            đây chỉ là cách đọc nhanh bằng mắt, không phải nguồn thông tin riêng. */}
        <div
          aria-hidden
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full",
              isFull ? "bg-warning" : "bg-primary",
            )}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {enrollments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có học viên nào"
            description="Ghi danh học viên đầu tiên vào lớp này."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4">
              {closed.length > 0 && (
                <div
                  role="group"
                  aria-label="Lọc theo tình trạng ghi danh"
                  className="bg-muted flex shrink-0 gap-0.5 rounded-lg p-0.5"
                >
                  <ScopeChip
                    label="Đang học"
                    count={open.length}
                    active={scope === "open"}
                    onClick={() => changeScope("open")}
                  />
                  <ScopeChip
                    label="Đã đóng"
                    count={closed.length}
                    active={scope === "closed"}
                    onClick={() => changeScope("closed")}
                  />
                </div>
              )}

              {enrollments.length > VISIBLE_LIMIT && (
                <div className="relative min-w-40 flex-1">
                  <Label htmlFor={`enroll-search-${classId}`} className="sr-only">
                    Tìm học viên trong lớp
                  </Label>
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden
                  />
                  <Input
                    id={`enroll-search-${classId}`}
                    type="search"
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                    placeholder="Tìm tên hoặc mã…"
                    className="h-9 pl-9"
                  />
                </div>
              )}
            </div>

            {matched.length === 0 ? (
              <p className="text-text-secondary px-4 pb-4 text-sm">
                {needle
                  ? `Không có học viên nào khớp “${query.trim()}”.`
                  : scope === "open"
                    ? "Lớp chưa có ghi danh nào đang mở."
                    : "Chưa có ghi danh nào đã đóng."}
              </p>
            ) : (
              <>
                <ul className="divide-y border-t">
                  {visible.map((e) => (
                    <EnrollmentRow
                      key={e.id}
                      classId={classId}
                      enrollment={e}
                      transferTargets={transferTargets}
                    />
                  ))}
                </ul>

                {(hiddenCount > 0 || expanded) && (
                  <div className="px-4 pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setExpanded((v) => !v)}
                    >
                      {hiddenCount > 0
                        ? `Xem thêm ${hiddenCount} học viên`
                        : "Thu gọn danh sách"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScopeChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // `aria-pressed` chứ không chỉ đổi màu nền: trạng thái "đang chọn" phải
      // đọc được bằng trình đọc màn hình, không chỉ bằng mắt (`color-not-only`).
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-text-secondary hover:text-foreground",
      )}
    >
      {label}{" "}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/**
 * Một hàng học viên — hai dòng, ~52px.
 *
 * ⛔ **Đừng trải các nút thao tác ra ngang hàng nữa.** Bản trước để 4 nút
 * (`Tạm dừng` · `Xác nhận hoàn thành` · `Rút học` · `Chuyển lớp`) cộng nút lịch
 * sử nằm thẳng trong hàng. Ở cột phải rộng ~21rem chúng luôn xuống 2–3 dòng,
 * đẩy mỗi hàng lên ~130px; và trước đó bản cũ hơn còn dính `shrink-0` khiến
 * khối nút rộng 516px trong khung 360px → tràn ngang 193px (`UX-UIUX-M16-002`).
 * Gom vào menu `⋯` giải quyết cả hai: hàng không còn phụ thuộc bề rộng nút, và
 * mỗi hàng chỉ còn **một** đích bấm thay vì năm.
 *
 * Hộp thoại được **dựng theo yêu cầu**, không dựng sẵn 5 cái cho mỗi hàng như
 * bản cũ: lớp 40 học viên trước đây mount ~200 `Dialog`, trong đó mỗi
 * `TransferDialog` còn kèm một `Select` liệt kê toàn bộ lớp đích.
 */
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
  const name = enrollment.student?.full_name ?? "Học viên";

  const [statusTarget, setStatusTarget] = useState<EnrollmentStatus | null>(
    null,
  );
  const [statusOpen, setStatusOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Giữ `statusTarget` lại khi đóng (chỉ hạ `statusOpen`) để hộp thoại còn nội
  // dung mà chạy hết animation đóng, thay vì biến mất giữa chừng.
  const openStatus = (next: EnrollmentStatus) => {
    setStatusTarget(next);
    setStatusOpen(true);
  };

  // Rút học là hành động không quay lại được — tách khỏi nhóm thao tác thường
  // để không bị bấm nhầm khi menu vừa bật lên (`destructive-nav-separation`).
  const safeTransitions = transitions.filter((s) => s !== "withdrawn");
  const hasWithdraw = transitions.includes("withdrawn");

  return (
    <li>
      <div className="hover:bg-row-hover flex items-center gap-2 px-4 py-2 transition-colors">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={name}>
            {name}
          </p>
          {/* Badge đứng đầu dòng 2 nên mọi hàng có trạng thái thẳng một cột —
              mắt quét dọc được thay vì phải dò lại từng hàng. */}
          <p className="text-text-secondary flex min-w-0 items-center gap-1.5 text-xs">
            <StatusBadge
              label={ENROLLMENT_STATUS_LABELS[enrollment.status]}
              tone={ENROLLMENT_STATUS_TONE[enrollment.status]}
              className="shrink-0 px-1.5 py-0 text-[11px]"
            />
            <span className="truncate tabular-nums">
              {enrollment.student?.student_code} ·{" "}
              {formatDate(enrollment.enrolled_on)}
              {enrollment.ended_on && ` → ${formatDate(enrollment.ended_on)}`}
            </span>
          </p>
          {enrollment.reason && (
            // Cắt một dòng nhưng giữ nguyên văn trong `title`: lý do rút/tạm
            // dừng là thứ sáu tháng sau còn phải tra lại được.
            <p
              className="text-text-secondary mt-0.5 line-clamp-1 text-xs italic"
              title={enrollment.reason}
            >
              “{enrollment.reason}”
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={`Thao tác cho ${name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {safeTransitions.map((next) => {
              const Icon = ACTION_ICONS[next];
              return (
                <DropdownMenuItem key={next} onSelect={() => openStatus(next)}>
                  <Icon className="size-4" aria-hidden />
                  {ENROLLMENT_ACTION_LABELS[next]}
                </DropdownMenuItem>
              );
            })}

            {canTransfer && (
              <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                <ArrowRightLeft className="size-4" aria-hidden />
                Chuyển lớp
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
              <History className="size-4" aria-hidden />
              Lịch sử ghi danh
            </DropdownMenuItem>

            {hasWithdraw && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => openStatus("withdrawn")}
                >
                  <UserMinus className="size-4" aria-hidden />
                  {ENROLLMENT_ACTION_LABELS.withdrawn}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {statusTarget && (
        <StatusChangeDialog
          classId={classId}
          enrollment={enrollment}
          nextStatus={statusTarget}
          open={statusOpen}
          onOpenChange={setStatusOpen}
        />
      )}

      {transferOpen && (
        <TransferDialog
          classId={classId}
          enrollment={enrollment}
          targets={transferTargets}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}

      {historyOpen && (
        <HistoryDialog
          enrollment={enrollment}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}
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
  open,
  onOpenChange,
}: {
  classId: string;
  enrollment: Enrollment;
  nextStatus: EnrollmentStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction } = useFormAction(changeEnrollmentStatusAction, {
    onSuccess: () => onOpenChange(false),
  });

  const label = ENROLLMENT_ACTION_LABELS[nextStatus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onClick={() => onOpenChange(false)}
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
  open,
  onOpenChange,
}: {
  classId: string;
  enrollment: Enrollment;
  targets: ClassTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction } = useFormAction(transferEnrollmentAction, {
    onSuccess: () => onOpenChange(false),
  });

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onClick={() => onOpenChange(false)}
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

function HistoryDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: Enrollment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
              {h.reason && <p className="mt-1 text-sm italic">“{h.reason}”</p>}
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
          className="shrink-0"
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
