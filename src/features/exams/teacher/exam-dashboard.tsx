"use client";
import Link from "next/link";
import { useState } from "react";
import { createExamDeliveryAction } from "@/features/exams/server/actions";
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
    question_set: { id: string; title: string; kind: string; status: string };
  }>;
};
export function ExamDashboard({ deliveries, classes, sets }: Props) {
  const [open, setOpen] = useState(false);
  const form = useFormAction(createExamDeliveryAction, {
    onSuccess: () => setOpen(false),
    toastError: true,
  });
  const noSets = sets.length === 0;
  const noClasses = classes.length === 0;
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Tạo kỳ thi</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lên lịch kỳ thi</DialogTitle>
              <DialogDescription>
                Khung mở/đóng bắt buộc cùng một ngày Việt Nam; deadline do DB
                quyết định.
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
                <Select name="set_version_id" required>
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
                <Label htmlFor="exam-class">Lớp</Label>
                <Select name="class_id" required>
                  <SelectTrigger id="exam-class">
                    <SelectValue placeholder="Chọn lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-title">Tiêu đề</Label>
                <Input id="exam-title" name="title" required />
              </div>
              <input type="hidden" name="exam_type" value="custom" />
              <div className="space-y-2"><Label htmlFor="exam-answer-release">Công bố đáp án</Label><select id="exam-answer-release" name="answer_release_mode" defaultValue="never" className="bg-background h-9 w-full rounded-md border px-3 text-sm"><option value="never">Không công bố</option><option value="with_results">Cùng kết quả</option></select></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exam-opens-at">Mở lúc</Label>
                  <DateTimePicker id="exam-opens-at" name="opens_at" placeholder="Chọn ngày giờ" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-closes-at">Đóng lúc</Label>
                  <DateTimePicker id="exam-closes-at" name="closes_at" placeholder="Chọn ngày giờ" />
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
                <p>
                  {new Date(d.opens_at).toLocaleString("vi-VN")} →{" "}
                  {new Date(d.closes_at).toLocaleString("vi-VN")}
                </p>
                <p>
                  {d.duration_minutes} phút · {d.attempts.length} lượt thi ·{" "}
                  {
                    d.attempts.filter(
                      (a) => a.status === "pending_manual_grading",
                    ).length
                  }{" "}
                  chờ chấm
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/teacher/exams/${d.id}`}>Theo dõi & chấm</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
