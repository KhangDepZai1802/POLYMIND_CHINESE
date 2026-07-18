"use client";

import Link from "next/link";
import { useState } from "react";

import { createExerciseDeliveryAction } from "@/features/exercises/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { useFormAction } from "@/lib/use-form-action";

type Props = {
  deliveries: Array<{
    id: string;
    title: string;
    status: string;
    available_from: string;
    due_at: string;
    max_score: number;
    class: { code: string; name: string } | null;
    attempts: Array<{
      id: string;
      status: string;
      is_late: boolean;
      final_score: number | null;
      results_published_at: string | null;
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
export function ExerciseDashboard({ deliveries, classes, sets }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState("");
  const form = useFormAction(createExerciseDeliveryAction, {
    onSuccess: () => setOpen(false),
    toastError: true,
  });
  const noSets = sets.length === 0;
  const noClasses = classes.length === 0;
  const selectedSet = sets.find((set) => set.id === selectedSetId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Giao bài tập</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Giao bộ bài tập</DialogTitle>
              <DialogDescription>
                Mỗi lớp tạo một lần giao riêng; chỉ hiện lớp bạn phụ trách.
              </DialogDescription>
            </DialogHeader>
            {noSets && (
              <Alert>
                <AlertDescription>
                  Chưa có bộ bài tập nào được khóa. Hãy sang bước ②{" "}
                  <strong>Bộ bài tập</strong>, tạo một bộ rồi bấm{" "}
                  <strong>Kiểm tra &amp; khóa bộ</strong> trước khi giao.
                </AlertDescription>
              </Alert>
            )}
            <form action={form.formAction} className="space-y-4">
              <input type="hidden" name="publish" value="true" />
              {form.state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{form.state.error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Bộ bài tập đã khóa</Label>
                <Select
                  name="set_version_id"
                  value={selectedSetId}
                  onValueChange={setSelectedSetId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bộ" />
                  </SelectTrigger>
                  <SelectContent>
                    {sets.map((set) => (
                      <SelectItem key={set.id} value={set.id}>
                        {set.title_snapshot} · v{set.version_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Cách chọn điểm</Label>
                  <select
                    name="grading_method"
                    defaultValue="latest"
                    className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="first">Lượt đầu</option>
                    <option value="latest">Lượt cuối</option>
                    <option value="highest">Lượt cao nhất</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Công bố điểm</Label>
                  <select
                    name="result_release_mode"
                    defaultValue="manual"
                    className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="manual">Thủ công</option>
                    <option value="after_graded">Ngay sau chấm</option>
                    <option value="after_due">Sau hạn</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Công bố đáp án</Label>
                  <select
                    name="answer_release_mode"
                    defaultValue="with_results"
                    className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="never">Không công bố</option>
                    <option value="after_submit">Sau khi nộp</option>
                    <option value="after_due">Sau hạn</option>
                    <option value="with_results">Cùng kết quả</option>
                  </select>
                </div>
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
              <div className="space-y-2">
                <Label>Tiêu đề</Label>
                <Input name="title" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mở từ</Label>
                  <DateTimePicker
                    name="available_from"
                    placeholder="Chọn ngày giờ"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hạn nộp</Label>
                  <DateTimePicker name="due_at" placeholder="Chọn ngày giờ" />
                </div>
                <div className="space-y-2">
                  <Label>Điểm tối đa (theo bộ đã chọn)</Label>
                  <Input
                    type="number"
                    value={selectedSet?.raw_max_score ?? ""}
                    placeholder="Chọn bộ bài tập"
                    readOnly
                  />
                  <p className="text-muted-foreground text-xs">
                    Tự động bằng tổng điểm giáo viên đã đặt cho các câu hỏi.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Số lượt</Label>
                  <Input
                    name="attempt_limit"
                    type="number"
                    min="1"
                    max="20"
                    defaultValue="1"
                    required
                  />
                </div>
              </div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" name="allow_late" />
                Cho phép nộp trễ
              </Label>
              <div className="space-y-2">
                <Label>Phạt trễ (%)</Label>
                <Input
                  name="late_penalty"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="0"
                />
              </div>
              <DialogFooter>
                <SubmitButton disabled={noSets || noClasses}>
                  Giao & công bố
                </SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {deliveries.length === 0 ? (
        <p className="text-muted-foreground text-center">
          Chưa có lần giao bài tập.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {deliveries.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle>{d.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  {d.class?.code} — {d.class?.name}
                </p>
                <p className="text-muted-foreground">
                  {new Date(d.available_from).toLocaleString("vi-VN")} →{" "}
                  {new Date(d.due_at).toLocaleString("vi-VN")}
                </p>
                <div className="flex gap-4">
                  <span>{d.attempts.length} lượt</span>
                  <span>
                    {
                      d.attempts.filter(
                        (a) => a.status === "pending_manual_grading",
                      ).length
                    }{" "}
                    chờ chấm
                  </span>
                  <span>{d.attempts.filter((a) => a.is_late).length} trễ</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/teacher/exercises/${d.id}`}>
                    Theo dõi & chấm
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
