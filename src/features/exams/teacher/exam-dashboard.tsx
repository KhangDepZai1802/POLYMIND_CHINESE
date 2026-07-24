"use client";
import Link from "next/link";
import { useState } from "react";

import { CalendarClock } from "lucide-react";

import { createExamDeliveryAction } from "@/features/exams/server/actions";
import { groupDeliveriesByClass } from "@/features/assessment-results/group-deliveries";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { NativeSelect } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/dates";
import { useFormAction } from "@/lib/use-form-action";

/**
 * Ô tick gốc của trình duyệt nhưng có vòng focus và màu thương hiệu.
 *
 * Giống hệt lý do đã ghi ở `exercise-dashboard.tsx`: `class_ids` được
 * `createExamDeliveryAction` đọc thẳng từ `FormData` dưới dạng **nhiều giá trị
 * cùng một tên** — đó là hành vi nghiệp vụ ("mở cùng kỳ thi cho nhiều lớp"),
 * không phải chuyện trình bày, nên `DS-003` cấm đổi sang Radix. Chỉ sửa phần
 * nhìn thấy: bản cũ chỉ có `size-4`, tức không có vòng focus — bàn phím không
 * biết đang đứng ở ô nào.
 */
const CHECKBOX_CLASS =
  "accent-primary border-input focus-visible:ring-ring size-4 shrink-0 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none";

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
  const deliveryGroups = groupDeliveriesByClass(deliveries);
  return (
    <div className="space-y-6">
      {/* `flex-wrap`: ở 360px nút không còn chỗ thì xuống dòng thay vì đẩy tràn ngang. */}
      <div className="flex flex-wrap gap-2">
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
              {/*
                `<fieldset>` + `<legend>` chứ không phải `<Label>` lơ lửng: đây
                là một NHÓM checkbox. Bản cũ dùng `<Label>` không `htmlFor` gì
                cả, nên trình đọc màn hình đọc từng ô là "checkbox LOP-01" mà
                không bao giờ nói đang chọn cái gì — đúng lỗi đã sửa ở M16.
              */}
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm leading-none font-medium">
                  Lớp (có thể chọn nhiều)
                </legend>
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
                        className={CHECKBOX_CLASS}
                      />
                      {c.code} — {c.name}
                    </Label>
                  ))}
                </div>
              </fieldset>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  Tổng điểm câu hỏi: {selectedSet?.raw_max_score ?? "—"}
                </p>
                {/*
                  `text-sm` chứ không `text-xs`: câu này nói ra quy tắc tính
                  điểm (`EX-18` — bài thi quy về thang 100), là thông tin giáo
                  viên cần đọc chứ không phải chú thích trang trí (`UX-M00-004`).
                */}
                <p className="text-text-secondary mt-1 text-sm">
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
                {/*
                  Đây là bản chép thứ 6 của chuỗi class `<select>` mà M16 đã gom
                  vào `NativeSelect` — cũng dùng `border` (1.27:1, gần như vô
                  hình) thay vì `border-input` (3.39:1) và `h-9` trong khi thang
                  control `DS-013` cho ô nhập là `h-10`.
                */}
                <NativeSelect
                  id="exam-answer-release"
                  name="answer_release_mode"
                  defaultValue="never"
                >
                  <option value="never">Không công bố</option>
                  <option value="with_results">Cùng kết quả</option>
                </NativeSelect>
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
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CalendarClock}
              title="Chưa có kỳ thi"
              description="Chọn một bộ đề đã khóa rồi bấm Tạo kỳ thi để mở khung thi cho lớp của bạn."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {deliveryGroups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`exam-group-${group.key}`}
              className="bg-card overflow-hidden rounded-xl border"
            >
              <div className="bg-surface-sunken flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2
                  id={`exam-group-${group.key}`}
                  className="min-w-0 truncate font-semibold"
                >
                  {group.label}
                </h2>
                <span className="text-text-secondary shrink-0 text-sm">
                  {group.items.length} kỳ thi
                </span>
              </div>
              {/* `<ul>/<li>` thật: trình đọc màn hình nói được "danh sách 5 mục". */}
              <ul className="divide-y">
                {group.items.map((delivery) => {
                  const waiting = delivery.attempts.filter(
                    (attempt) => attempt.status === "pending_manual_grading",
                  ).length;
                  return (
                    <li
                      key={delivery.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{delivery.title}</p>
                        {/*
                          `text-sm` chứ không `text-xs`: đây là dòng giáo viên
                          quét để quyết định mở kỳ thi nào trước (`UX-M00-004`).
                        */}
                        <p className="text-text-secondary text-sm">
                          {/*
                            `formatDateTime` chứ không `toLocaleString("vi-VN")`.
                            `toLocaleString("vi-VN")` chỉ đổi NGÔN NGỮ,
                            không đổi MÚI GIỜ: nó lấy múi giờ của MÁY giáo viên,
                            nên cùng một `closes_at` thì máy đặt lệch múi giờ sẽ
                            hiện sai giờ đóng — và in ra `20:05:00 22/7/2026`
                            thay vì `dd/MM/yyyy HH:mm`. Giờ đóng sai là thứ giáo
                            viên dựa vào để dặn học viên, nên đây là lỗi thật.
                          */}
                          Đóng {formatDateTime(delivery.closes_at)} ·{" "}
                          {delivery.duration_minutes} phút ·{" "}
                          {delivery.attempts.length} bài thi
                          {waiting > 0 ? ` · ${waiting} chờ chấm` : ""}
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant={waiting > 0 ? "default" : "outline"}
                      >
                        <Link href={`/teacher/exams/${delivery.id}`}>
                          {/*
                            Mọi hàng đều có cùng chữ "Mở lớp & chấm thi". Trình
                            đọc màn hình liệt kê link ra thì được một danh sách
                            giống hệt nhau, không biết link nào là kỳ thi nào.
                          */}
                          <span className="sr-only">{delivery.title}: </span>
                          Mở lớp &amp; chấm thi
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
