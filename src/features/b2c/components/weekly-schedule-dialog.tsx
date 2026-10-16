"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  readWeeklyScheduleAction,
  saveWeeklyScheduleAction,
} from "../server/weekly-schedule-actions";
import {
  WEEKLY_DAYS,
  readWeeklySlots,
  type WeeklySlot,
} from "../domain/weekly-schedule";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
type Loaded = Awaited<ReturnType<typeof readWeeklyScheduleAction>>;
export function WeeklyScheduleDialog({ classId }: { classId: string }) {
  const router = useRouter(),
    refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [record, setRecord] = useState<Loaded | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<WeeklySlot[]>([]);
  async function load() {
    setBusy(true);
    setError("");
    setRecord(null);
    try {
      const data = await readWeeklyScheduleAction(classId);
      const d = readWeeklySlots(data.weekdays_text, data.time_text);
      setDefaults(d);
      setDays(d.map((s) => s.day));
      setRecord(data);
    } catch {
      setError("Không tải được lịch tuần. Đóng rồi mở lại để thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarDays className="size-4" aria-hidden />
          Sửa lịch học hằng tuần
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa lịch học hằng tuần</DialogTitle>
          <DialogDescription>
            Chọn thứ học rồi nhập giờ riêng cho từng thứ. Không cần ngày bắt đầu
            hoặc kết thúc.
          </DialogDescription>
        </DialogHeader>
        {busy && !record && <p role="status">Đang tải…</p>}
        {record && (
          <form
            key={record.updated_at}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                const result = await saveWeeklyScheduleAction({
                  class_id: classId,
                  expected_updated_at: record.updated_at,
                  teacher_name: f.get("teacher_name"),
                  slots: WEEKLY_DAYS.filter((day) => days.includes(day)).map(
                    (day) => ({
                      day,
                      start_time: f.get(`start_${day}`),
                      end_time: f.get(`end_${day}`),
                    }),
                  ),
                });
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  refresh();
                  router.refresh();
                }
              } catch {
                setError("Không kết nối được. Vui lòng thử lại.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-sm">
              Giáo viên
              <Input
                name="teacher_name"
                required
                maxLength={200}
                defaultValue={record.teacher_name ?? ""}
                disabled={busy}
              />
            </label>
            <fieldset disabled={busy}>
              <legend className="mb-2 text-sm font-medium">Thứ học</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKLY_DAYS.map((d) => (
                  <label
                    key={d}
                    className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={days.includes(d)}
                      onChange={(e) =>
                        setDays((current) =>
                          e.target.checked
                            ? [...current, d]
                            : current.filter((x) => x !== d),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            {WEEKLY_DAYS.filter((day) => days.includes(day)).map((day) => (
              <fieldset
                key={day}
                disabled={busy}
                className="rounded-lg border p-3"
              >
                <legend className="px-1 text-sm font-semibold">
                  Giờ học {day}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    Giờ bắt đầu {day}
                    <Input
                      type="time"
                      name={`start_${day}`}
                      required
                      defaultValue={
                        defaults.find((s) => s.day === day)?.start_time ?? ""
                      }
                      disabled={busy}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Giờ kết thúc {day}
                    <Input
                      type="time"
                      name={`end_${day}`}
                      required
                      defaultValue={
                        defaults.find((s) => s.day === day)?.end_time ?? ""
                      }
                      disabled={busy}
                    />
                  </label>
                </div>
              </fieldset>
            ))}
            <p className="text-muted-foreground text-xs">
              Lưu lịch tuần không tự tạo hoặc thay đổi các buổi học theo ngày đã
              có.
            </p>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || days.length === 0}>
              {busy ? "Đang lưu…" : "Lưu lịch tuần"}
            </Button>
          </form>
        )}
        {!record && error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
