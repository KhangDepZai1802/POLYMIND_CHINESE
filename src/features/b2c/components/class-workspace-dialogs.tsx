"use client";
import { useState } from "react";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
import { formatInTimeZone } from "date-fns-tz";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ATTENDANCE_STATUSES,
  MEETING_STATUSES,
  type ClassStudent,
  type ClassMeeting,
} from "../domain/class-workspace";
import {
  saveClassMeetingAction,
  saveClassAttendanceAction,
  addClassCommentAction,
} from "../server/class-workspace-actions";
export function ClassMeetingDialog({
  classId,
  teacherName,
  today,
  meeting,
}: {
  classId: string;
  teacherName: string;
  today: string;
  meeting?: ClassMeeting;
}) {
  const refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={meeting ? "outline" : "default"}>
          {meeting ? "Sửa buổi học" : "Thêm buổi học"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {meeting ? "Sửa buổi học" : "Thêm buổi học"}
          </DialogTitle>
          <DialogDescription>
            Giờ Việt Nam. Lịch học ở đây không tự ghi công/lương giáo viên.
            {meeting?.schedule_id
              ? " Buổi sinh từ lịch lặp giữ ngày/giờ gốc; hủy buổi và thêm buổi bù khi cần đổi lịch."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await saveClassMeetingAction({
                class_id: classId,
                request_id: request,
                id: meeting?.id,
                date: f.get("date"),
                start_time: f.get("start_time"),
                end_time: f.get("end_time"),
                teacher_name: f.get("teacher_name"),
                room_name: f.get("room_name"),
                status: f.get("status"),
                note: f.get("note"),
                expected_updated_at: meeting?.updated_at,
              });
              if (r.error) setError(r.error);
              else {
                setOpen(false);
                refresh();
              }
            } catch {
              setError("Không lưu được buổi học.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            Ngày học
            <Input
              name="date"
              type="date"
              required
              readOnly={!!meeting?.schedule_id}
              min="1900-01-01"
              defaultValue={
                meeting
                  ? formatInTimeZone(
                      meeting.starts_at,
                      "Asia/Ho_Chi_Minh",
                      "yyyy-MM-dd",
                    )
                  : today
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {["start_time", "end_time"].map((name, i) => (
              <label key={name} className="grid gap-1 text-sm">
                {i ? "Giờ kết thúc" : "Giờ bắt đầu"}
                <Input
                  name={name}
                  type="time"
                  required
                  readOnly={!!meeting?.schedule_id}
                  defaultValue={
                    meeting
                      ? formatInTimeZone(
                          i ? meeting.ends_at : meeting.starts_at,
                          "Asia/Ho_Chi_Minh",
                          "HH:mm",
                        )
                      : ""
                  }
                />
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-sm">
            Giáo viên
            <Input
              name="teacher_name"
              maxLength={200}
              defaultValue={meeting?.teacher_name ?? teacherName}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Phòng học (tùy chọn)
            <Input
              name="room_name"
              maxLength={120}
              defaultValue={meeting?.room_name ?? ""}
              placeholder="Cơ sở 1 – Phòng 201"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Trạng thái buổi
            <select
              name="status"
              aria-label="Trạng thái buổi"
              defaultValue={meeting?.status ?? "planned"}
              className="bg-background rounded border p-2"
            >
              {Object.entries(MEETING_STATUSES).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Ghi chú
            <textarea
              name="note"
              maxLength={2000}
              defaultValue={meeting?.note ?? ""}
              className="min-h-20 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu buổi học"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ClassAttendanceDialog({
  classId,
  meeting,
  student,
}: {
  classId: string;
  meeting: ClassMeeting;
  student: ClassStudent;
}) {
  const refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          {student.attendance_status ? "Sửa điểm danh" : "Điểm danh"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Điểm danh: {student.full_name}</DialogTitle>
          <DialogDescription>
            {formatInTimeZone(
              meeting.starts_at,
              "Asia/Ho_Chi_Minh",
              "dd/MM/yyyy HH:mm",
            )}{" "}
            · Không tự đánh dấu học viên chưa nhập là vắng.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await saveClassAttendanceAction({
                class_id: classId,
                request_id: request,
                meeting_id: meeting.id,
                enrollment_id: student.enrollment_id,
                status: f.get("status"),
                note: f.get("note"),
                expected_updated_at: student.attendance_updated_at,
              });
              if (r.error) setError(r.error);
              else {
                setOpen(false);
                refresh();
              }
            } catch {
              setError("Không lưu được điểm danh.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            Trạng thái điểm danh
            <select
              name="status"
              aria-label="Trạng thái điểm danh"
              required
              defaultValue={student.attendance_status ?? ""}
              className="bg-background min-h-11 rounded border p-2"
            >
              <option value="" disabled>
                Chọn trạng thái
              </option>
              {Object.entries(ATTENDANCE_STATUSES).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Ghi chú điểm danh
            <textarea
              name="note"
              maxLength={1000}
              defaultValue={student.attendance_note ?? ""}
              className="min-h-20 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu điểm danh"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ClassCommentDialog({
  classId,
  student,
  meeting,
}: {
  classId: string;
  student: ClassStudent;
  meeting?: ClassMeeting | null;
}) {
  const refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Nhận xét</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhận xét: {student.full_name}</DialogTitle>
          <DialogDescription>
            {meeting
              ? `Buổi ${formatInTimeZone(meeting.starts_at, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm")}`
              : "Nhận xét chung trong lớp"}
            . Giữ người ghi và thời điểm; bổ sung nhận xét mới khi cần đính
            chính.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await addClassCommentAction({
                class_id: classId,
                request_id: request,
                enrollment_id: student.enrollment_id,
                meeting_id: meeting?.id ?? null,
                content: f.get("content"),
              });
              if (r.error) setError(r.error);
              else {
                setOpen(false);
                refresh();
              }
            } catch {
              setError("Không lưu được nhận xét.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            Nội dung nhận xét
            <textarea
              name="content"
              required
              maxLength={4000}
              className="min-h-36 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu nhận xét"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
