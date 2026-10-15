"use client";
import { useState } from "react";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
import { CalendarDays } from "lucide-react";
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
import { WEEKDAYS, countPlannedMeetings } from "../domain/structured-schedule";
import { generateB2CScheduleAction } from "../server/schedule-actions";
export function StructuredScheduleDialog({
  classId,
  today,
  openingDate,
}: {
  classId: string;
  today: string;
  openingDate: string | null;
}) {
  const refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [request, setRequest] = useState("");
  const initial = openingDate && openingDate > today ? openingDate : today;
  const [from, setFrom] = useState(initial),
    [to, setTo] = useState(initial),
    [days, setDays] = useState<number[]>([]);
  const count = countPlannedMeetings(days, from, to);
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (busy) return;
          setOpen(v);
          if (v) {
            setRequest(crypto.randomUUID());
            setError("");
            setMessage("");
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            <CalendarDays
              className="size-4 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
            Lịch lặp & sinh buổi
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lịch lặp & sinh buổi</DialogTitle>
            <DialogDescription>
              Giờ Việt Nam. Lưu lịch sẽ tự sinh buổi trong khoảng ngày; không
              ghi công hoặc tính lương giáo viên.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                const r = await generateB2CScheduleAction({
                  class_id: classId,
                  request_id: request,
                  weekdays: days,
                  date_from: from,
                  date_to: to,
                  start_time: f.get("start_time"),
                  end_time: f.get("end_time"),
                  room_name: f.get("room_name"),
                });
                if (r.error) setError(r.error);
                else {
                  setMessage(r.success ?? "");
                  setOpen(false);
                  refresh();
                }
              } catch {
                setError(
                  "Không sinh được buổi học. Có thể thử lại cùng yêu cầu.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Thứ học</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(([v, l]) => (
                  <label
                    key={v}
                    className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={days.includes(v)}
                      onChange={(e) =>
                        setDays((current) =>
                          e.target.checked
                            ? [...current, v]
                            : current.filter((d) => d !== v),
                        )
                      }
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                Từ ngày
                <Input
                  type="date"
                  required
                  min={openingDate || "1900-01-01"}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Đến ngày
                <Input
                  type="date"
                  required
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                Giờ bắt đầu
                <Input type="time" name="start_time" required />
              </label>
              <label className="grid gap-1 text-sm">
                Giờ kết thúc
                <Input type="time" name="end_time" required />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Phòng học (tùy chọn)
              <Input
                name="room_name"
                maxLength={120}
                placeholder="Ví dụ: Cơ sở 1 – Phòng 201"
              />
            </label>
            <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              {count} buổi dự kiến · Tối đa 366 ngày. Để trống phòng = chưa xếp
              phòng.
            </p>
            <p className="text-muted-foreground text-xs">
              Buổi đã có được giữ nguyên. Nếu trùng giờ lớp/phòng hoặc khác lịch
              hiện có, toàn bộ lượt sinh sẽ bị hủy. Cần dùng cùng tên cơ
              sở/phòng để kiểm tra trùng chính xác.
            </p>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || !count}>
              {busy ? "Đang sinh buổi…" : "Lưu lịch & sinh buổi"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {message && (
        <p
          role="status"
          className="mt-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {message}
        </p>
      )}
    </>
  );
}
