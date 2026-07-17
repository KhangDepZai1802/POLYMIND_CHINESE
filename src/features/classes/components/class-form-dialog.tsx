"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import {
  createClassAction,
  updateClassAction,
} from "@/features/classes/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { toDateInputValue } from "@/lib/dates";
import { CLASS_STATUS_LABELS, DELIVERY_MODE_LABELS } from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type CourseOption = {
  id: string;
  code: string;
  title: string;
  status: Database["public"]["Enums"]["course_status"];
  default_session_count: number | null;
  default_session_duration_minutes: number | null;
};

type ClassRecord = Database["public"]["Tables"]["classes"]["Row"];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

export function ClassFormDialog({
  courses,
  classRecord,
  trigger,
}: {
  courses: CourseOption[];
  classRecord?: ClassRecord;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(classRecord);
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(
    isEdit ? updateClassAction : createClassAction,
    { onSuccess: () => setOpen(false) },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            Mở lớp mới
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa thông tin lớp" : "Mở lớp mới"}
          </DialogTitle>
          <DialogDescription>
            Lớp là một lần triển khai cụ thể của khóa học. Lịch và từng buổi học
            được cấu hình riêng sau khi tạo lớp.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          {isEdit && <input type="hidden" name="id" value={classRecord!.id} />}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="class-course">Khóa học *</Label>
            <Select
              name="course_id"
              defaultValue={classRecord?.course_id}
              required
            >
              <SelectTrigger id="class-course" className="w-full">
                <SelectValue placeholder="Chọn khóa học" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} — {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={fe["course_id"]} />
          </div>

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Mã lớp được hệ thống tự sinh sau khi lưu.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="class-name">Tên lớp *</Label>
            <Input
              id="class-name"
              name="name"
              required
              defaultValue={classRecord?.name}
              placeholder="HSK 1 — Khóa tối thứ Ba/Năm"
            />
            <FieldError message={fe["name"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="capacity">Sĩ số tối đa *</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                required
                defaultValue={classRecord?.capacity ?? 20}
              />
              <FieldError message={fe["capacity"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planned_session_count">Số buổi dự kiến</Label>
              <Input
                id="planned_session_count"
                name="planned_session_count"
                type="number"
                min={1}
                defaultValue={classRecord?.planned_session_count ?? ""}
                placeholder="VD: 35"
              />
              <FieldError message={fe["planned_session_count"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_duration_minutes">Phút/buổi</Label>
              <Input
                id="session_duration_minutes"
                name="session_duration_minutes"
                type="number"
                min={1}
                defaultValue={classRecord?.session_duration_minutes ?? ""}
                placeholder="VD: 90"
              />
              <FieldError message={fe["session_duration_minutes"]} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Ngày khai giảng</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={toDateInputValue(classRecord?.start_date)}
              />
              <FieldError message={fe["start_date"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_end_date">Dự kiến kết thúc</Label>
              <Input
                id="expected_end_date"
                name="expected_end_date"
                type="date"
                defaultValue={toDateInputValue(classRecord?.expected_end_date)}
              />
              <FieldError message={fe["expected_end_date"]} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_audience">Đối tượng học viên</Label>
            <Input
              id="target_audience"
              name="target_audience"
              defaultValue={classRecord?.target_audience ?? ""}
              placeholder="Để trống để dùng đối tượng của khóa học"
            />
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Hình thức & địa điểm</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery_mode">Hình thức *</Label>
                <Select
                  name="delivery_mode"
                  defaultValue={classRecord?.delivery_mode ?? "offline"}
                >
                  <SelectTrigger id="delivery_mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELIVERY_MODE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_name">Tên địa điểm</Label>
                <Input
                  id="location_name"
                  name="location_name"
                  defaultValue={classRecord?.location_name ?? ""}
                  placeholder="Phòng 301 / Trụ sở khách hàng"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={classRecord?.address ?? ""}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="meeting_url">Link phòng học trực tuyến</Label>
                <Input
                  id="meeting_url"
                  name="meeting_url"
                  type="url"
                  defaultValue={classRecord?.meeting_url ?? ""}
                  placeholder="https://meet.google.com/..."
                />
                <FieldError message={fe["meeting_url"]} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="location_note">
                  Ghi chú địa điểm linh hoạt
                </Label>
                <Textarea
                  id="location_note"
                  name="location_note"
                  rows={2}
                  defaultValue={classRecord?.location_note ?? ""}
                  placeholder="VD: học tại địa điểm do Ban Giám đốc xác nhận từng buổi"
                />
              </div>
            </div>
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="class-status">Trạng thái</Label>
              <Select name="status" defaultValue={classRecord!.status}>
                <SelectTrigger id="class-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLASS_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Kích hoạt lớp yêu cầu ngày khai giảng, số buổi, thời lượng và
                đúng một giáo viên chính.
              </p>
            </div>
          ) : (
            <>
              <input type="hidden" name="status" value="planned" />
              <p className="text-muted-foreground text-xs">
                Lớp mới ở trạng thái <strong>Sắp mở</strong>. Phân công giáo
                viên chính trước khi kích hoạt.
              </p>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>{isEdit ? "Lưu thay đổi" : "Tạo lớp"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
