"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import {
  createCourseAction,
  updateCourseAction,
} from "@/features/courses/server/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  CORE_COURSE_TYPE_LABELS,
  COURSE_PROGRAM_LABELS,
  COURSE_STATUS_LABELS,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type Level = { id: string; code: string; name: string };
type CourseProgram = Database["public"]["Enums"]["course_program"];
type CourseType = Database["public"]["Enums"]["course_type"];

type Course = {
  id: string;
  code: string;
  title: string;
  title_en: string | null;
  program: CourseProgram;
  course_type: CourseType | null;
  level_id: string | null;
  target_audience: string | null;
  objectives: string | null;
  description: string | null;
  default_session_count: number | null;
  default_session_duration_minutes: number | null;
  default_tuition_amount: number | null;
  completion_min_attendance_rate: number;
  completion_min_overall_score: number;
  completion_require_all_exercises: boolean;
  status: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

export function CourseFormDialog({
  levels,
  course,
  trigger,
}: {
  levels: Level[];
  course?: Course;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(course);
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState<CourseProgram>(
    course?.program ?? "core",
  );

  const { state, formAction } = useFormAction(
    isEdit ? updateCourseAction : createCourseAction,
    { onSuccess: () => setOpen(false) },
  );

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            Thêm khóa học
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa khóa học" : "Thêm khóa học"}</DialogTitle>
          <DialogDescription>
            Khóa học là <strong>bản thiết kế</strong> chương trình. Việc mở lớp
            (sĩ số, giáo viên, lịch, ngày khai giảng) làm ở mục Lớp học.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={course!.id} />}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program">Chương trình *</Label>
              <Select
                name="program"
                value={program}
                onValueChange={(value) => setProgram(value as CourseProgram)}
              >
                <SelectTrigger id="program" className="w-full">
                  <SelectValue placeholder="Chọn chương trình" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COURSE_PROGRAM_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <FieldError message={fe["program"]} />
            </div>

            {program === "core" && (
              <div className="space-y-2">
                <Label htmlFor="course_type">Loại *</Label>
                <Select
                  name="course_type"
                  defaultValue={course?.course_type ?? "hsk"}
                >
                  <SelectTrigger id="course_type" className="w-full">
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CORE_COURSE_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FieldError message={fe["course_type"]} />
              </div>
            )}
          </div>

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Mã khóa học được hệ thống tự sinh sau khi lưu.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Tên khóa học *</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={course?.title}
              placeholder="Tiếng Trung HSK 1"
            />
            <FieldError message={fe["title"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title_en">Tên tiếng Anh</Label>
              <Input
                id="title_en"
                name="title_en"
                defaultValue={course?.title_en ?? ""}
                placeholder="Chinese HSK 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level_id">Bậc năng lực</Label>
              <Select name="level_id" defaultValue={course?.level_id ?? "none"}>
                <SelectTrigger id="level_id" className="w-full">
                  <SelectValue placeholder="Không gắn bậc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn bậc</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Khóa doanh nghiệp/tùy chỉnh thường không gắn bậc HSK.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_audience">Đối tượng</Label>
            <Input
              id="target_audience"
              name="target_audience"
              defaultValue={course?.target_audience ?? ""}
              placeholder="Người mới bắt đầu / Ban Giám đốc / …"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectives">Mục tiêu</Label>
            <Textarea
              id="objectives"
              name="objectives"
              rows={2}
              defaultValue={course?.objectives ?? ""}
            />
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-1 text-sm font-medium">Giá trị mặc định</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Chỉ là gợi ý khi mở lớp. Để trống nếu chưa chốt — số buổi và thời
              lượng <strong>thật</strong> được xác định ở từng lớp.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="default_session_count">Số buổi</Label>
                <Input
                  id="default_session_count"
                  name="default_session_count"
                  type="number"
                  min={1}
                  defaultValue={course?.default_session_count ?? ""}
                  placeholder="—"
                />
                <FieldError message={fe["default_session_count"]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_session_duration_minutes">
                  Phút/buổi
                </Label>
                <Input
                  id="default_session_duration_minutes"
                  name="default_session_duration_minutes"
                  type="number"
                  min={1}
                  defaultValue={course?.default_session_duration_minutes ?? ""}
                  placeholder="—"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_tuition_amount">Học phí (VND)</Label>
                <Input
                  id="default_tuition_amount"
                  name="default_tuition_amount"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={course?.default_tuition_amount ?? ""}
                  placeholder="—"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-1 text-sm font-medium">
              Điều kiện hoàn thành khóa
            </p>
            <p className="text-muted-foreground mb-3 text-xs">
              Hệ thống chỉ <strong>tính</strong> và hiển thị &quot;đủ / chưa đủ
              điều kiện&quot;. Người xác nhận hoàn thành vẫn là giáo viên hoặc
              quản trị viên.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="completion_min_attendance_rate">
                  Chuyên cần tối thiểu (%)
                </Label>
                <Input
                  id="completion_min_attendance_rate"
                  name="completion_min_attendance_rate"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={course?.completion_min_attendance_rate ?? 80}
                />
                <FieldError message={fe["completion_min_attendance_rate"]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion_min_overall_score">
                  Điểm tối thiểu (0–100)
                </Label>
                <Input
                  id="completion_min_overall_score"
                  name="completion_min_overall_score"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={course?.completion_min_overall_score ?? 50}
                />
                <FieldError message={fe["completion_min_overall_score"]} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                id="completion_require_all_exercises"
                name="completion_require_all_exercises"
                defaultChecked={course?.completion_require_all_exercises}
              />
              <Label
                htmlFor="completion_require_all_exercises"
                className="font-normal"
              >
                Bắt buộc nộp đủ bài tập
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <Select name="status" defaultValue={course?.status ?? "draft"}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>
              {isEdit ? "Lưu thay đổi" : "Tạo khóa học"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
