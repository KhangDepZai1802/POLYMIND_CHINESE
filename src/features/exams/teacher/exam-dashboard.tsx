"use client";
import Link from "next/link";
import { useState } from "react";
import { createExamDeliveryAction } from "@/features/exams/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { useFormAction } from "@/lib/use-form-action";
type Props = {
  deliveries: Array<{
    id: string;
    title: string;
    status: string;
    opens_at: string;
    closes_at: string;
    duration_minutes: number;
    results_published_at: string | null;
    class: { code: string; name: string } | null;
    attempts: Array<{
      id: string;
      status: string;
      final_score_100: number | null;
    }>;
  }>;
  classes: Array<{ id: string; code: string; name: string; status: string }>;
  sets: Array<{
    id: string;
    version_no: number;
    title_snapshot: string;
    raw_max_score: number;
    question_set: { id: string; title: string; kind: string; status: string };
  }>;
};
export function ExamDashboard({ deliveries, classes, sets }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState("");
  const form = useFormAction(createExamDeliveryAction, {
    onSuccess: () => setOpen(false),
    toastError: true,
  });
  const noSets = sets.length === 0;
  const noClasses = classes.length === 0;
  const selectedSet = sets.find((set) => set.id === selectedSetId);
  const deliveryGroups = deliveries.reduce<
    Array<{ key: string; label: string; items: Props["deliveries"] }>
  >((groups, delivery) => {
    const key = delivery.class?.code ?? "unassigned";
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = {
        key,
        label: delivery.class
          ? `${delivery.class.code} — ${delivery.class.name}`
          : "Chưa xác định lớp",
        items: [],
      };
      groups.push(group);
    }
    group.items.push(delivery);
    return groups;
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Tạo kỳ thi</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lên lịch kỳ thi</DialogTitle>
              <DialogDescription>
                Khung mở/đóng có thể kéo dài nhiều ngày — học viên vào làm lúc
                nào cũng được trong khung; mỗi lượt vẫn bị giới hạn bởi thời
                lượng.
              </DialogDescription>
            </DialogHeader>
            {noSets && (
              <Alert>
                <AlertDescription>
                  Chưa có bộ đề nào được khóa. Hãy sang bước ②{" "}
                  <strong>Bộ đề</strong>, tạo một đề rồi bấm{" "}
                  <strong>Kiểm tra &amp; khóa bộ</strong> trước khi lên lịch.
                </AlertDescription>
              </Alert>
            )}
            <form action={form.formAction} className="space-y-4">
              {form.state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{form.state.error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="exam-set-version">Bộ đề đã khóa</Label>
                <Select
                  name="set_version_id"
                  value={selectedSetId}
                  onValueChange={setSelectedSetId}
                  required
                >
                  <SelectTrigger id="exam-set-version">
                    <SelectValue placeholder="Chọn bộ đề" />
                  </SelectTrigger>
                  <SelectContent>
                    {sets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title_snapshot} · v{s.version_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lớp (có thể chọn nhiều)</Label>
                <div className="grid gap-2 rounded-lg border p-3">
                  {classes.map((c) => (
                    <Label
                      key={c.id}
                      className="flex items-center gap-2 font-normal"
                    >
                      <input
                        type="checkbox"
                        name="class_ids"
                        value={c.id}
                        className="size-4"
                      />
                      {c.code} — {c.name}
                    </Label>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  Tổng điểm câu hỏi: {selectedSet?.raw_max_score ?? "—"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Kết quả bài thi được hệ thống tự quy đổi về thang 100.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-title">Tiêu đề</Label>
                <Input id="exam-title" name="title" required />
              </div>
              <input type="hidden" name="exam_type" value="custom" />
              <div className="space-y-2">
                <Label htmlFor="exam-answer-release">Công bố đáp án</Label>
                <select
                  id="exam-answer-release"
                  name="answer_release_mode"
                  defaultValue="never"
                  className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="never">Không công bố</option>
                  <option value="with_results">Cùng kết quả</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exam-opens-at">Mở lúc</Label>
                  <DateTimePicker
                    id="exam-opens-at"
                    name="opens_at"
                    placeholder="Chọn ngày giờ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-closes-at">Đóng lúc</Label>
                  <DateTimePicker
                    id="exam-closes-at"
                    name="closes_at"
                    placeholder="Chọn ngày giờ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-duration">Thời lượng (phút)</Label>
                  <Input
                    id="exam-duration"
                    name="duration_minutes"
                    type="number"
                    min="1"
                    defaultValue="45"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-passing-score">Điểm đạt</Label>
                  <Input
                    id="exam-passing-score"
                    name="passing_score"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue="50"
                  />
                </div>
              </div>
              <DialogFooter>
                <SubmitButton disabled={noSets || noClasses}>
                  Lên lịch
                </SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {deliveries.length === 0 ? (
        <p className="text-muted-foreground text-center">Chưa có kỳ thi.</p>
      ) : (
        <div className="space-y-5">
          {deliveryGroups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <h2 className="font-semibold">{group.label}</h2>
                <span className="text-muted-foreground text-sm">{group.items.length} kỳ thi</span>
              </div>
              <div className="divide-y">
                {group.items.map((delivery) => {
                  const waiting = delivery.attempts.filter(
                    (attempt) => attempt.status === "pending_manual_grading",
                  ).length;
                  return (
                    <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{delivery.title}</p>
                        <p className="text-muted-foreground text-xs">
                          Đóng {new Date(delivery.closes_at).toLocaleString("vi-VN")} · {delivery.duration_minutes} phút · {delivery.attempts.length} bài thi
                          {waiting > 0 ? ` · ${waiting} chờ chấm` : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant={waiting > 0 ? "default" : "outline"}>
                        <Link href={`/teacher/exams/${delivery.id}`}>Mở lớp & chấm thi</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
