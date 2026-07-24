"use client";

import Link from "next/link";
import { useState } from "react";

import { ClipboardList } from "lucide-react";

import { createExerciseDeliveryAction } from "@/features/exercises/server/actions";
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
 * Không dùng `ui/checkbox.tsx` (Radix) ở màn này: cả `class_ids` lẫn
 * `allow_late` được `createExerciseDeliveryAction` đọc thẳng từ `FormData`, và
 * `class_ids` là **nhiều giá trị cùng một tên** — cách gửi đó là hành vi
 * nghiệp vụ, không phải chuyện trình bày.
 */
const CHECKBOX_CLASS =
  "accent-primary border-input focus-visible:ring-ring size-4 shrink-0 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none";

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
  const deliveryGroups = groupDeliveriesByClass(deliveries);
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
                <Label htmlFor="ex-set-version">Bộ bài tập đã khóa</Label>
                <Select
                  name="set_version_id"
                  value={selectedSetId}
                  onValueChange={setSelectedSetId}
                  required
                >
                  <SelectTrigger id="ex-set-version">
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
                  <Label htmlFor="ex-grading-method">Cách chọn điểm</Label>
                  <NativeSelect
                    id="ex-grading-method"
                    name="grading_method"
                    defaultValue="latest"
                  >
                    <option value="first">Lượt đầu</option>
                    <option value="latest">Lượt cuối</option>
                    <option value="highest">Lượt cao nhất</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-result-release">Công bố điểm</Label>
                  <NativeSelect
                    id="ex-result-release"
                    name="result_release_mode"
                    defaultValue="manual"
                  >
                    <option value="manual">Thủ công</option>
                    <option value="after_graded">Ngay sau chấm</option>
                    <option value="after_due">Sau hạn</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-answer-release">Công bố đáp án</Label>
                  <NativeSelect
                    id="ex-answer-release"
                    name="answer_release_mode"
                    defaultValue="with_results"
                  >
                    <option value="never">Không công bố</option>
                    <option value="after_submit">Sau khi nộp</option>
                    <option value="after_due">Sau hạn</option>
                    <option value="with_results">Cùng kết quả</option>
                  </NativeSelect>
                </div>
              </div>
              {/*
                `<fieldset>` + `<legend>` chứ không phải một `<Label>` lơ lửng:
                đây là một NHÓM checkbox, và trước đây cái `<Label>` đó không
                `htmlFor` gì cả nên trình đọc màn hình đọc từng ô là "checkbox
                LOP-01" mà không bao giờ nói đang chọn cái gì.
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
                      {/*
                        Cố ý giữ `<input type="checkbox">` gốc, KHÔNG đổi sang
                        `ui/checkbox.tsx` (Radix): đây là nhóm nhiều ô cùng
                        `name="class_ids"`, và cách gửi nhiều giá trị cùng tên
                        là hành vi nghiệp vụ ("giao một lúc cho nhiều lớp").
                        Đổi sang input ẩn của Radix là đổi thứ không được phép
                        đổi trong task UI/UX (`DS-003`). Chỉ sửa phần trình bày.
                      */}
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
              <div className="space-y-2">
                <Label htmlFor="ex-title">Tiêu đề</Label>
                <Input id="ex-title" name="title" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ex-available-from">Mở từ</Label>
                  <DateTimePicker
                    id="ex-available-from"
                    name="available_from"
                    placeholder="Chọn ngày giờ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-due-at">Hạn nộp</Label>
                  <DateTimePicker
                    id="ex-due-at"
                    name="due_at"
                    placeholder="Chọn ngày giờ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-max-score">
                    Điểm tối đa (theo bộ đã chọn)
                  </Label>
                  <Input
                    id="ex-max-score"
                    type="number"
                    value={selectedSet?.raw_max_score ?? ""}
                    placeholder="Chọn bộ bài tập"
                    readOnly
                    aria-describedby="ex-max-score-hint"
                  />
                  <p id="ex-max-score-hint" className="text-text-secondary text-sm">
                    Tự động bằng tổng điểm giáo viên đã đặt cho các câu hỏi.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-attempt-limit">Số lượt</Label>
                  <Input
                    id="ex-attempt-limit"
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
                <input
                  type="checkbox"
                  name="allow_late"
                  className={CHECKBOX_CLASS}
                />
                Cho phép nộp trễ
              </Label>
              <div className="space-y-2">
                <Label htmlFor="ex-late-penalty">Phạt trễ (%)</Label>
                <Input
                  id="ex-late-penalty"
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
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="Chưa có lần giao bài tập"
              description="Chọn một bộ bài tập đã khóa rồi bấm Giao bài tập để lớp của bạn bắt đầu làm."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {deliveryGroups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`delivery-group-${group.key}`}
              className="bg-card overflow-hidden rounded-xl border"
            >
              <div className="bg-surface-sunken flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2
                  id={`delivery-group-${group.key}`}
                  className="min-w-0 truncate font-semibold"
                >
                  {group.label}
                </h2>
                <span className="text-text-secondary shrink-0 text-sm">
                  {group.items.length} bài tập
                </span>
              </div>
              <ul className="divide-y">
                {group.items.map((delivery) => {
                  const waiting = delivery.attempts.filter(
                    (attempt) => attempt.status === "pending_manual_grading",
                  ).length;
                  const late = delivery.attempts.filter(
                    (attempt) => attempt.is_late,
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
                          quét để quyết định mở bài nào trước (hạn, số bài chờ
                          chấm), không phải chú thích phụ — `UX-M00-004`.
                        */}
                        <p className="text-text-secondary text-sm">
                          {/*
                            `formatDateTime` chứ không `toLocaleString("vi-VN")`:
                            `D-12` bắt hiển thị theo `Asia/Ho_Chi_Minh` và định
                            dạng `dd/MM/yyyy HH:mm`. Bản cũ lấy múi giờ của MÁY
                            giáo viên nên hạn nộp lệch giờ khi máy đặt múi giờ
                            khác, và in ra `20:05:00 22/7/2026`.
                          */}
                          Hạn {formatDateTime(delivery.due_at)} ·{" "}
                          {delivery.attempts.length} bài nộp
                          {waiting > 0 ? ` · ${waiting} chờ chấm` : ""}
                          {late > 0 ? ` · ${late} nộp trễ` : ""}
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant={waiting > 0 ? "default" : "outline"}
                      >
                        <Link href={`/teacher/exercises/${delivery.id}`}>
                          <span className="sr-only">{delivery.title}: </span>
                          Mở lớp &amp; chấm bài
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
