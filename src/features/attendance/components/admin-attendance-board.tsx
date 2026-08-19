"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  FileCheck2,
  Loader2,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  summarizeAttendance,
  type AttendanceStatus,
} from "@/features/reports/learning";
import { formatDate, formatPercent } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { adminOverrideAttendanceAction } from "../server/admin-actions";
import type {
  AdminAttendanceBoard as BoardData,
  AdminAttendanceClass,
} from "../server/admin-queries";
import {
  ATTENDANCE_CELL,
  ATTENDANCE_STATUSES,
  UNMARKED_LABEL,
  UNMARKED_SYMBOL,
} from "../status-display";

/**
 * Tab "Điểm danh" của `/admin/reports` (`ADMIN-ATTENDANCE-1`, `D-45`).
 *
 * =============================================================================
 * BỐ CỤC: MỘT LỚP = MỘT MỤC THU GỌN SẴN
 * =============================================================================
 *
 * User chốt "chia theo từng lớp cho dễ nhìn". Mở trang ra thấy CẤU TRÚC trước
 * (có mấy lớp, lớp nào còn ô trống), rồi mới mở đúng lớp cần xem — cùng khuôn
 * `UX-STUDENTS-1` đã dùng cho `/admin/students`. Đổ thẳng 3 lưới × 35 cột vào
 * một màn hình là bắt người ta cuộn qua hai lớp không liên quan.
 *
 * =============================================================================
 * 🔴 SỬA XONG KHÔNG LƯU NGAY — GOM LẠI RỒI LƯU MỘT LƯỢT
 * =============================================================================
 *
 * Mỗi ô bấm là một lần ghi DB thì sửa nhầm không có đường lùi, và mỗi lần ghi
 * lại đóng thêm một dấu "đã sửa" lên báo cáo đã ký (`D-45` vế 2). Gom lại thì
 * người bấm còn kịp nhìn tổng thể, còn nút Hoàn tác, và cả lượt xuống DB trong
 * MỘT transaction — không có chuyện lưu được nửa bảng.
 *
 * =============================================================================
 * ĐIỀU HƯỚNG BÀN PHÍM: MỘT ĐIỂM DỪNG TAB CHO CẢ LƯỚI
 * =============================================================================
 *
 * Lớp 26 học viên × 35 buổi = 910 ô. Để mỗi ô là một điểm dừng Tab thì người
 * dùng bàn phím phải bấm Tab 910 lần mới ra khỏi lưới — về hình thức là "có
 * hỗ trợ bàn phím", về thực chất là một cái bẫy. Dùng roving tabindex: cả lưới
 * đúng MỘT điểm dừng, đi lại bằng phím mũi tên (đúng khuôn `grid` của WAI-ARIA).
 */

type PendingEdit = {
  classId: string;
  sessionId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  note: string;
};

type ActiveCell = {
  key: string;
  classId: string;
  sessionId: string;
  enrollmentId: string;
  studentName: string;
  sessionLabel: string;
  hasSubmittedReport: boolean;
};

const cellKey = (sessionId: string, enrollmentId: string) =>
  `${sessionId}:${enrollmentId}`;

export function AdminAttendanceBoard({
  board,
  canEdit,
}: {
  board: BoardData;
  /**
   * `false` cho giáo vụ (`D-45` vế 4). Lưới vẫn hiện ĐẦY ĐỦ — giáo vụ cần đọc
   * số liệu hằng ngày; thứ bị lấy đi là quyền GHI, không phải quyền nhìn.
   */
  canEdit: boolean;
}) {
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, PendingEdit>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const anchorRef = useRef<HTMLElement | null>(null);

  const setCell = (edit: PendingEdit) =>
    setPending((prev) => ({
      ...prev,
      [cellKey(edit.sessionId, edit.enrollmentId)]: edit,
    }));

  const resetClass = (classId: string) =>
    setPending((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([, edit]) => edit.classId !== classId),
      ),
    );

  const save = (item: AdminAttendanceClass) => {
    const changes = Object.values(pending).filter(
      (edit) => edit.classId === item.classId,
    );
    if (changes.length === 0) return;

    setSavingClass(item.classId);
    startSaving(async () => {
      const body = new FormData();
      body.set(
        "changes",
        JSON.stringify(
          changes.map((edit) => ({
            session_id: edit.sessionId,
            enrollment_id: edit.enrollmentId,
            status: edit.status,
            ...(edit.note.trim() ? { note: edit.note.trim() } : {}),
          })),
        ),
      );
      const reason = reasons[item.classId]?.trim();
      if (reason) body.set("reason", reason);

      const result = await adminOverrideAttendanceAction(body);
      setSavingClass(null);

      if (result.error) {
        // 🔴 KHÔNG xoá `pending` khi lỗi. Người dùng vừa sửa 12 ô; nuốt mất
        // chúng để họ gõ lại từ đầu là cách chắc chắn nhất để họ bỏ luôn việc.
        toast.error(result.error);
        return;
      }

      resetClass(item.classId);
      setReasons((prev) => ({ ...prev, [item.classId]: "" }));
      toast.success(result.success ?? "Đã lưu điểm danh.");
    });
  };

  if (board.classes.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={CalendarCheck}
            title="Kỳ này chưa có buổi học nào đã diễn ra"
            description="Chọn kỳ khác ở thanh lọc phía trên, hoặc chờ tới buổi học đầu tiên."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        {board.classes.map((item) => (
          /*
            🔴 `min-w-0` KHÔNG PHẢI CHO ĐẸP — thiếu nó là trang tràn ngang 329px
            ở 360px, đo được bằng Playwright chứ mắt thường không thấy.

            `<li>` là ô của grid, mà ô grid mặc định `min-width: auto` ⇒ nó tự
            nới ra vừa nội dung rộng nhất bên trong (lưới 35 cột), rồi đẩy phình
            cả trang. Khung `overflow-x-auto` bên trong không cứu được: nó chỉ
            cuộn khi bị ép hẹp lại, mà ở đây chẳng có gì ép nó cả. Cùng họ với
            bẫy `shrink-0` đã sập ba lần (`UX-UIUX-M16-002`, `UX-STUDENTS-1`).
          */
          <li key={item.classId} className="min-w-0">
            <ClassPanel
              item={item}
              canEdit={canEdit}
              open={openClasses[item.classId] ?? false}
              onToggle={() =>
                setOpenClasses((prev) => ({
                  ...prev,
                  [item.classId]: !prev[item.classId],
                }))
              }
              pending={pending}
              reason={reasons[item.classId] ?? ""}
              onReasonChange={(value) =>
                setReasons((prev) => ({ ...prev, [item.classId]: value }))
              }
              onOpenCell={(cell, element) => {
                anchorRef.current = element;
                setActive(cell);
              }}
              onReset={() => resetClass(item.classId)}
              onSave={() => save(item)}
              saving={isSaving && savingClass === item.classId}
            />
          </li>
        ))}
      </ul>

      {/*
        MỘT Popover cho cả trang, neo vào ô vừa bấm bằng `virtualRef`.
        Gắn một Popover vào mỗi ô nghĩa là dựng 910 React context cho một lớp —
        chỉ để mỗi lần đúng một cái được mở.
      */}
      <Popover
        open={active !== null}
        onOpenChange={(next) => {
          if (next) return;
          setActive(null);
          // Trả tiêu điểm về đúng ô vừa sửa. Không làm vế này thì người dùng bàn
          // phím đóng popover xong rơi về đầu trang, mất chỗ đang đứng.
          anchorRef.current?.focus();
        }}
      >
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
        {active && (
          <CellEditor
            cell={active}
            value={
              pending[active.key]?.status ??
              savedStatus(board, active) ??
              null
            }
            note={pending[active.key]?.note ?? savedNote(board, active) ?? ""}
            onChange={(status, note) =>
              setCell({
                classId: active.classId,
                sessionId: active.sessionId,
                enrollmentId: active.enrollmentId,
                status,
                note,
              })
            }
          />
        )}
      </Popover>
    </>
  );
}

function savedCell(board: BoardData, cell: ActiveCell) {
  const item = board.classes.find((c) => c.classId === cell.classId);
  return item?.cells[cell.key];
}
const savedStatus = (board: BoardData, cell: ActiveCell) =>
  savedCell(board, cell)?.status ?? null;
const savedNote = (board: BoardData, cell: ActiveCell) =>
  savedCell(board, cell)?.note ?? "";

// ---------------------------------------------------------------------------
// Một lớp
// ---------------------------------------------------------------------------

function ClassPanel({
  item,
  canEdit,
  open,
  onToggle,
  pending,
  reason,
  onReasonChange,
  onOpenCell,
  onReset,
  onSave,
  saving,
}: {
  item: AdminAttendanceClass;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  pending: Record<string, PendingEdit>;
  reason: string;
  onReasonChange: (value: string) => void;
  onOpenCell: (cell: ActiveCell, element: HTMLElement) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const panelId = `diem-danh-${item.classId}`;

  const changes = useMemo(
    () => Object.values(pending).filter((edit) => edit.classId === item.classId),
    [pending, item.classId],
  );

  /*
   * Cảnh báo phải đếm theo BUỔI có báo cáo đã gửi, không phải theo số ô.
   * Sửa 8 ô của cùng một buổi là chạm đúng MỘT bản báo cáo — báo "8 báo cáo sẽ
   * đổi" là nói sai về hậu quả, và nói sai theo hướng đáng sợ hơn sự thật.
   */
  const touchedSubmitted = useMemo(() => {
    const submitted = new Set(
      item.sessions.filter((s) => s.hasSubmittedReport).map((s) => s.id),
    );
    return new Set(
      changes.map((edit) => edit.sessionId).filter((id) => submitted.has(id)),
    ).size;
  }, [changes, item.sessions]);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="hover:bg-row-hover focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
      >
        <ChevronRight
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="bg-muted shrink-0 rounded px-2 py-0.5 font-mono text-sm font-medium">
          {item.code}
        </span>
        {/* `min-w-0 flex-1` cạnh các khối `shrink-0`: đúng cái bẫy đã sập ba lần
            (`UX-UIUX-M16-002`, `UX-STUDENTS-1`). Tên lớp là khối co được, nên
            phải có `truncate` + `title` chứ không được để nó co về 0 ký tự. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium" title={item.name}>
            {item.name}
          </span>
          <span className="text-text-secondary block truncate text-xs">
            {item.teacherName} · {item.sessions.length} buổi ·{" "}
            {item.students.length} học viên
          </span>
        </span>

        {changes.length > 0 && (
          <span className="bg-primary/12 text-primary border-primary/25 shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums">
            {changes.length} chưa lưu
          </span>
        )}
        {item.missingCells > 0 && (
          <span
            className="bg-warning/12 text-warning border-warning/25 shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums"
            title="Số ô chưa ai điểm danh"
          >
            {item.missingCells} ô trống
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="border-t">
          {item.sessions.length === 0 || item.students.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={
                item.sessions.length === 0
                  ? "Kỳ này lớp chưa có buổi nào đã diễn ra"
                  : "Lớp chưa có học viên đang học"
              }
              description={
                item.sessions.length === 0
                  ? "Đổi kỳ ở thanh lọc phía trên để xem các buổi khác."
                  : "Chỉ hiện học viên có ghi danh đang mở."
              }
            />
          ) : (
            <>
              <Legend canEdit={canEdit} />
              <AttendanceEditGrid
                item={item}
                canEdit={canEdit}
                pending={pending}
                onOpenCell={onOpenCell}
              />
              {changes.length > 0 && (
                <SaveBar
                  count={changes.length}
                  touchedSubmitted={touchedSubmitted}
                  reason={reason}
                  onReasonChange={onReasonChange}
                  onReset={onReset}
                  onSave={onSave}
                  saving={saving}
                />
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function Legend({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="bg-surface-sunken flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
      {ATTENDANCE_STATUSES.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${ATTENDANCE_CELL[status].className}`}
          >
            {ATTENDANCE_CELL[status].symbol}
          </span>
          {ATTENDANCE_CELL[status].label}
        </span>
      ))}
      <span className="text-muted-foreground flex items-center gap-1.5">
        <span aria-hidden className="grid size-5 shrink-0 place-items-center">
          {UNMARKED_SYMBOL}
        </span>
        {UNMARKED_LABEL}
      </span>
      <span className="text-text-secondary ml-auto text-xs">
        {canEdit
          ? "Bấm vào ô để sửa · phím mũi tên để đi lại trong lưới"
          : "Chỉ quản trị viên sửa được điểm danh"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lưới buổi × học viên
// ---------------------------------------------------------------------------

function AttendanceEditGrid({
  item,
  canEdit,
  pending,
  onOpenCell,
}: {
  item: AdminAttendanceClass;
  canEdit: boolean;
  pending: Record<string, PendingEdit>;
  onOpenCell: (cell: ActiveCell, element: HTMLElement) => void;
}) {
  // Ô đang giữ điểm dừng Tab duy nhất của lưới (roving tabindex).
  const [focused, setFocused] = useState({ row: 0, col: 0 });
  const gridRef = useRef<HTMLTableSectionElement | null>(null);

  const move = (rowDelta: number, colDelta: number) => {
    const row = Math.min(
      Math.max(focused.row + rowDelta, 0),
      item.students.length - 1,
    );
    const col = Math.min(
      Math.max(focused.col + colDelta, 0),
      item.sessions.length - 1,
    );
    setFocused({ row, col });
    // Tìm theo toạ độ chứ không giữ mảng ref: bảng dựng lại mỗi lần đổi kỳ,
    // mảng ref thì không tự dọn và trỏ vào nút đã bị gỡ.
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${row}-${col}"]`)
      ?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = map[event.key];
    if (delta) {
      event.preventDefault();
      move(delta[0], delta[1]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      move(0, -item.sessions.length);
    }
    if (event.key === "End") {
      event.preventDefault();
      move(0, item.sessions.length);
    }
  };

  return (
    <div
      data-slot="table-scroller"
      role="region"
      aria-label={`Sổ điểm danh lớp ${item.code}, cuộn ngang để xem đủ các buổi`}
      tabIndex={0}
      /*
        🔴 `relative` KHÔNG PHẢI THỪA — thiếu nó là trang tràn ngang 231px ở
        360px, và mắt thường không thấy vì thứ tràn ra là chữ vô hình.

        Mỗi ô mang một `<span class="sr-only">` để trình đọc màn hình đọc được
        "Tên, buổi 3: Vắng". Tailwind dựng `sr-only` bằng `position: absolute`,
        mà **phần tử absolute chỉ bị cắt bởi tổ tiên NẰM TRONG chuỗi containing
        block của nó** — khung cuộn này vốn `position: static` nên không phải
        containing block, và mấy chục span đó neo thẳng vào khung nhìn gốc.
        Kết quả đo được: `body.scrollWidth = 360` (mọi thứ trông như đã kìm
        đúng) trong khi `documentElement.scrollWidth = 591`.

        `relative` biến khung này thành containing block ⇒ `overflow-x-auto`
        cắt chúng như cắt mọi thứ khác.

        ⚠️ Cùng khuôn này còn nằm ở `features/reports/components/attendance-grid.tsx`
        (lưới chỉ-đọc của tab Học tập) — chưa sửa vì ngoài phạm vi task, đã ghi
        vào WORKLOG.
      */
      className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">
          Điểm danh từng buổi của từng học viên lớp {item.code}.
          {canEdit
            ? " Bấm vào một ô để sửa trạng thái."
            : " Chỉ xem, không sửa được."}
        </caption>
        <thead className="text-muted-foreground border-b text-sm">
          <tr>
            <th
              scope="col"
              className="bg-card sticky left-0 z-10 border-r px-4 py-2 text-left font-medium"
            >
              Học viên
            </th>
            {item.sessions.map((session) => (
              <th
                key={session.id}
                scope="col"
                className="min-w-11 px-1 py-2 text-center font-medium"
                title={session.topic ?? undefined}
              >
                <span className="block tabular-nums">
                  B{session.sessionNumber}
                </span>
                <span className="block text-xs font-normal tabular-nums">
                  {formatDate(session.startsAt).slice(0, 5)}
                </span>
                {/*
                  🔴 DẤU HIỆU "BUỔI NÀY ĐÃ CÓ BÁO CÁO KÝ" ĐỨNG NGAY TRÊN CỘT.
                  Sửa ô của cột này là dựng lại số liệu trong một bản báo cáo đã
                  gửi (`D-45` vế 2) — người bấm phải biết TRƯỚC khi bấm, chứ
                  không phải đọc được trong câu thông báo sau khi lưu xong.
                */}
                {session.hasSubmittedReport && (
                  <FileCheck2
                    className="text-primary mx-auto mt-0.5 size-3"
                    aria-label="Đã có báo cáo giáo viên gửi"
                  />
                )}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Chuyên cần
            </th>
          </tr>
        </thead>
        <tbody ref={gridRef} className="divide-y" onKeyDown={onKeyDown}>
          {item.students.map((student, row) => {
            // Chuyên cần tính lại theo ô ĐANG NHÌN THẤY (đã gộp thay đổi chưa
            // lưu). Giữ nguyên số của máy chủ thì sửa 3 ô từ "vắng" sang "có
            // mặt" mà cột bên phải vẫn đứng im — đọc như thao tác không ăn.
            const effective = item.sessions
              .map(
                (session) =>
                  pending[cellKey(session.id, student.enrollmentId)]?.status ??
                  item.cells[cellKey(session.id, student.enrollmentId)]?.status,
              )
              .filter((status): status is AttendanceStatus => Boolean(status));
            const summary = summarizeAttendance(effective, item.sessions.length);

            return (
              <tr key={student.enrollmentId} className="even:bg-muted/40">
                <th
                  scope="row"
                  className="bg-card sticky left-0 z-10 max-w-52 border-r px-4 py-2 text-left font-normal"
                >
                  <span className="block truncate font-medium" title={student.fullName}>
                    {student.fullName}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {student.studentCode}
                  </span>
                </th>

                {item.sessions.map((session, col) => {
                  const key = cellKey(session.id, student.enrollmentId);
                  const saved = item.cells[key];
                  const edit = pending[key];
                  const status = edit?.status ?? saved?.status ?? null;
                  const dirty =
                    Boolean(edit) && edit?.status !== saved?.status;
                  const style = status ? ATTENDANCE_CELL[status] : null;
                  const label = style?.label ?? UNMARKED_LABEL;
                  const note = edit?.note ?? saved?.note ?? "";

                  const content = (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          "mx-auto grid size-7 place-items-center rounded-full text-xs font-semibold",
                          style?.className ?? "text-muted-foreground",
                          // Ô chưa lưu mang VIỀN, không chỉ mang màu: màu nền
                          // của bốn trạng thái đã dùng hết dải màu ngữ nghĩa,
                          // thêm một màu nữa là không ai đọc ra nó nghĩa gì.
                          dirty && "ring-primary ring-2 ring-offset-1",
                        )}
                      >
                        {style?.symbol ?? UNMARKED_SYMBOL}
                      </span>
                      <span className="sr-only">
                        {student.fullName}, buổi {session.sessionNumber}:{" "}
                        {label}
                        {note ? ` — ${note}` : ""}
                        {dirty ? " (chưa lưu)" : ""}
                      </span>
                    </>
                  );

                  if (!canEdit) {
                    return (
                      <td
                        key={session.id}
                        className="px-1 py-2 text-center"
                        title={note || undefined}
                      >
                        {content}
                      </td>
                    );
                  }

                  return (
                    <td key={session.id} className="p-0 text-center">
                      <button
                        type="button"
                        data-cell={`${row}-${col}`}
                        // Roving tabindex: đúng MỘT ô của lưới nhận Tab.
                        tabIndex={
                          focused.row === row && focused.col === col ? 0 : -1
                        }
                        onFocus={() => setFocused({ row, col })}
                        onClick={(event) =>
                          onOpenCell(
                            {
                              key,
                              classId: item.classId,
                              sessionId: session.id,
                              enrollmentId: student.enrollmentId,
                              studentName: student.fullName,
                              sessionLabel: `Buổi ${session.sessionNumber} · ${formatDate(session.startsAt)}`,
                              hasSubmittedReport: session.hasSubmittedReport,
                            },
                            event.currentTarget,
                          )
                        }
                        title={note || undefined}
                        // 44×44px là trần dưới của vùng chạm (WCAG 2.5.5 / HIG).
                        // Ô 28px trông gọn hơn nhưng trên điện thoại thì bấm
                        // trúng ô bên cạnh — cùng họ lỗi `UX-SCHED-1`.
                        className="hover:bg-row-hover focus-visible:ring-ring grid size-11 w-full place-items-center focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
                      >
                        {content}
                      </button>
                    </td>
                  );
                })}

                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {summary.rate === null ? "—" : formatPercent(summary.rate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover sửa một ô
// ---------------------------------------------------------------------------

function CellEditor({
  cell,
  value,
  note,
  onChange,
}: {
  cell: ActiveCell;
  value: AttendanceStatus | null;
  note: string;
  onChange: (status: AttendanceStatus, note: string) => void;
}) {
  const noteId = `ghi-chu-${cell.key}`;

  return (
    <PopoverContent align="center" className="w-72 p-3">
      <p className="text-sm font-semibold">{cell.studentName}</p>
      <p className="text-text-secondary mb-2 text-xs">{cell.sessionLabel}</p>

      {cell.hasSubmittedReport && (
        <p className="border-warning/30 bg-warning/5 text-warning mb-2 flex gap-1.5 rounded-md border p-2 text-xs">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Buổi này đã có báo cáo giáo viên gửi. Lưu thay đổi sẽ cập nhật lại
            số liệu chuyên cần trong bản báo cáo đó.
          </span>
        </p>
      )}

      {/*
        `radiogroup` + `radio` chứ không phải 4 cái nút: bốn trạng thái là bốn
        giá trị LOẠI TRỪ NHAU của một trường. Trình đọc màn hình đọc được "2 trên
        4" và phím mũi tên đi lại được — bốn `<button>` rời thì không có gì nói
        cho người dùng biết chúng thuộc cùng một lựa chọn.
      */}
      <div role="radiogroup" aria-label="Trạng thái điểm danh" className="grid gap-1">
        {ATTENDANCE_STATUSES.map((status) => {
          const style = ATTENDANCE_CELL[status];
          const selected = value === status;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(status, note)}
              className={cn(
                "focus-visible:ring-ring flex min-h-11 items-center gap-2 rounded-md border px-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary/8 font-semibold"
                  : "hover:bg-row-hover border-transparent",
              )}
            >
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${style.className}`}
              >
                {style.symbol}
              </span>
              {style.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid gap-1">
        <Label htmlFor={noteId} className="text-xs">
          Ghi chú (không bắt buộc)
        </Label>
        {/*
          Ghi chú CHỈ lưu được kèm một trạng thái — cùng ràng buộc như biểu mẫu
          của giáo viên. Chưa chọn trạng thái thì khoá ô lại và nói rõ vì sao,
          thay vì nhận chữ rồi đánh rơi im lặng lúc lưu (lỗi đã sửa ở
          `saveAttendanceAction`).
        */}
        <Input
          id={noteId}
          value={note}
          maxLength={300}
          disabled={value === null}
          placeholder={
            value === null ? "Chọn trạng thái trước" : "Ví dụ: phụ huynh báo ốm"
          }
          onChange={(event) => value && onChange(value, event.target.value)}
        />
      </div>
    </PopoverContent>
  );
}

// ---------------------------------------------------------------------------
// Thanh lưu
// ---------------------------------------------------------------------------

function SaveBar({
  count,
  touchedSubmitted,
  reason,
  onReasonChange,
  onReset,
  onSave,
  saving,
}: {
  count: number;
  touchedSubmitted: number;
  reason: string;
  onReasonChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    /*
      `sticky bottom-0` trong khung của lớp: lưới 26 hàng cao hơn màn hình, nên
      thanh lưu đứng ở đáy tài liệu là sửa xong phải cuộn đi tìm nút. Dính đáy
      thì nó luôn ở trong tầm mắt, và chỉ xuất hiện khi CÓ thay đổi — không có
      thay đổi mà vẫn chiếm chỗ là lấy mất một dải màn hình để nói "chưa có gì".
    */
    <div
      data-noprint
      className="bg-card/95 sticky bottom-0 z-20 border-t p-3 backdrop-blur"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {count} ô chưa lưu
            {touchedSubmitted > 0 && (
              <span className="text-warning ml-2 inline-flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3.5" aria-hidden />
                {touchedSubmitted} buổi đã có báo cáo gửi — số liệu chuyên cần
                trong báo cáo đó sẽ được cập nhật lại
              </span>
            )}
          </p>
          <Input
            value={reason}
            maxLength={300}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Lý do sửa (không bắt buộc) — lưu vào nhật ký hệ thống"
            className="mt-1"
            aria-label="Lý do sửa điểm danh"
          />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onReset} disabled={saving}>
            <Undo2 className="size-4" aria-hidden />
            Hoàn tác
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Lưu {count} thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
}
