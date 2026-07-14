"use client";

import { useState } from "react";
import { AlertCircle, Check, Clock, ShieldCheck, X } from "lucide-react";

import { saveAttendanceAction } from "@/features/attendance/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/use-form-action";

type AttendanceStatus = "present" | "late" | "absent" | "excused";

type RosterRow = {
  enrollmentId: string;
  studentName: string;
  studentCode: string;
  status: AttendanceStatus | null;
  note: string;
};

/**
 * Bốn trạng thái, bốn nút — không dùng dropdown.
 *
 * Giáo viên điểm danh giữa giờ, trên điện thoại, đôi khi vừa dạy vừa bấm. Mỗi
 * dropdown là hai thao tác (mở + chọn); nút là một. Touch target ≥ 44px theo
 * WCAG. Màu KHÔNG bao giờ là tín hiệu duy nhất — luôn kèm icon và chữ.
 */
const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  icon: typeof Check;
  activeClass: string;
}[] = [
  {
    value: "present",
    label: "Có mặt",
    icon: Check,
    activeClass: "bg-success text-white border-success hover:bg-success/90",
  },
  {
    value: "late",
    label: "Muộn",
    icon: Clock,
    activeClass: "bg-warning text-white border-warning hover:bg-warning/90",
  },
  {
    value: "absent",
    label: "Vắng",
    icon: X,
    activeClass:
      "bg-destructive text-white border-destructive hover:bg-destructive/90",
  },
  {
    value: "excused",
    label: "Có phép",
    icon: ShieldCheck,
    activeClass: "bg-primary text-white border-primary hover:bg-primary/90",
  },
];

export function AttendanceRoster({
  sessionId,
  roster,
}: {
  sessionId: string;
  roster: RosterRow[];
}) {
  // Trạng thái nằm ở client để giáo viên bấm là thấy ngay, không chờ server.
  // Nguồn sự thật vẫn là DB — bấm Lưu mới ghi.
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(
    () => Object.fromEntries(roster.map((r) => [r.enrollmentId, r.status])),
  );

  const { state, formAction } = useFormAction(saveAttendanceAction);

  const markedCount = Object.values(marks).filter(Boolean).length;
  const remaining = roster.length - markedCount;

  function setAll(status: AttendanceStatus) {
    setMarks(Object.fromEntries(roster.map((r) => [r.enrollmentId, status])));
  }

  return (
    <form action={formAction} className="pb-24">
      <input type="hidden" name="session_id" value={sessionId} />

      {state.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Chọn hàng loạt: đa số buổi thì gần như cả lớp có mặt. Bấm "Tất cả có
          mặt" rồi sửa vài người vắng nhanh hơn nhiều so với bấm từng người. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Đánh dấu nhanh:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAll("present")}
        >
          <Check className="size-4" aria-hidden />
          Tất cả có mặt
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAll("absent")}
        >
          <X className="size-4" aria-hidden />
          Tất cả vắng
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {roster.map((r) => (
          <li key={r.enrollmentId} className="p-4">
            {/* Trạng thái đi kèm mỗi học viên bằng hidden input: không chọn thì
                KHÔNG gửi field → server bỏ qua, học viên đó vẫn "chưa điểm danh"
                chứ không bị âm thầm đánh vắng. */}
            {marks[r.enrollmentId] && (
              <input
                type="hidden"
                name={`status_${r.enrollmentId}`}
                value={marks[r.enrollmentId] ?? ""}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.studentName}</p>
                <p className="text-muted-foreground text-xs">
                  {r.studentCode}
                  {r.status === null && " · chưa điểm danh"}
                </p>
              </div>

              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={`Điểm danh ${r.studentName}`}
              >
                {STATUS_OPTIONS.map((opt) => {
                  const active = marks[r.enrollmentId] === opt.value;
                  const Icon = opt.icon;

                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="outline"
                      // ≥ 44px chiều cao — bấm được bằng ngón tay, không cần ngắm.
                      className={`h-11 min-w-[5.5rem] ${active ? opt.activeClass : ""}`}
                      aria-pressed={active}
                      onClick={() =>
                        setMarks((prev) => ({
                          ...prev,
                          // Bấm lại đúng nút đang chọn = bỏ chọn (sửa nhầm).
                          [r.enrollmentId]: active ? null : opt.value,
                        }))
                      }
                    >
                      <Icon className="size-4" aria-hidden />
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Input
              name={`note_${r.enrollmentId}`}
              defaultValue={r.note}
              placeholder="Ghi chú (không bắt buộc)"
              className="mt-3"
            />
          </li>
        ))}
      </ul>

      {/* Thanh Lưu STICKY: danh sách 20 học viên thì nút Lưu ở cuối trang nằm
          ngoài màn hình. Giáo viên bấm xong phải cuộn đi tìm nút → dễ quên lưu. */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            Đã chọn <strong>{markedCount}</strong>/{roster.length}
            {remaining > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · còn {remaining} người chưa điểm danh
              </span>
            )}
          </p>
          <SubmitButton disabled={markedCount === 0} className="h-11 px-6">
            Lưu điểm danh
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
