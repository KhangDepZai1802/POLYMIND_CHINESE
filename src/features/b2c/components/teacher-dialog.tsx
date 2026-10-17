"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import { saveB2CTeacherAction } from "@/features/b2c/server/teacher-actions";
import type { B2CTeacher } from "@/features/b2c/teacher-schema";

export function B2CTeacherDialog({ teacher }: { teacher?: B2CTeacher }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(saveB2CTeacherAction, {
    onSuccess: () => setOpen(false),
  });
  const suffix = teacher?.id ?? "new";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {teacher ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa hồ sơ ${teacher.full_name}`}
          >
            <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Thêm giáo viên
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {teacher ? "Sửa hồ sơ giáo viên" : "Thêm giáo viên"}
          </DialogTitle>
          <DialogDescription>
            Thông tin liên hệ và giảng dạy tại trung tâm.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={teacher?.id ?? ""} />
          {[
            {
              name: "full_name",
              label: "Họ tên *",
              value: teacher?.full_name,
              max: 200,
              required: true,
              type: "text",
            },
            {
              name: "phone",
              label: "Số điện thoại",
              value: teacher?.phone,
              max: 30,
              type: "tel",
            },
            {
              name: "email",
              label: "Email liên hệ",
              value: teacher?.email,
              type: "email",
            },
            {
              name: "specialization",
              label: "Chuyên môn",
              value: teacher?.specialization,
              max: 1000,
              type: "text",
            },
          ].map((f) => (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={`${f.name}-${suffix}`}>{f.label}</Label>
              <Input
                id={`${f.name}-${suffix}`}
                name={f.name}
                type={f.type}
                maxLength={f.max}
                required={f.required}
                defaultValue={f.value ?? ""}
              />
              {state.fieldErrors?.[f.name] && (
                <p className="text-destructive text-sm">
                  {state.fieldErrors[f.name]}
                </p>
              )}
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor={`employment-${suffix}`}>Hình thức làm việc *</Label>
            <select
              id={`employment-${suffix}`}
              name="employment_type"
              required
              defaultValue={teacher?.employment_type ?? ""}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="" disabled>
                Chọn hình thức
              </option>
              <option value="full_time">Fulltime</option>
              <option value="part_time">Part-time</option>
            </select>
            {state.fieldErrors?.employment_type && (
              <p className="text-destructive text-sm">
                {state.fieldErrors.employment_type}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rate-${suffix}`}>Đơn giá / giờ (VNĐ) *</Label>
            <Input
              id={`rate-${suffix}`}
              name="hourly_rate"
              type="number"
              required
              min={0}
              max={999999999999}
              step={1}
              defaultValue={teacher?.hourly_rate ?? ""}
            />
            {state.fieldErrors?.hourly_rate && (
              <p className="text-destructive text-sm">
                {state.fieldErrors.hourly_rate}
              </p>
            )}
          </div>
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <SubmitButton>Lưu hồ sơ</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
