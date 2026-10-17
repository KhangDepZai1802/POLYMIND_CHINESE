"use client";
import { useState } from "react";
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
import { createTeachingSessionAction } from "@/features/b2c/server/teaching-actions";
export function TeachingSessionDialog({
  classes,
  teachers,
  today,
}: {
  classes: { id: string; name: string }[];
  teachers: { id: string; full_name: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(createTeachingSessionAction, {
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Thêm buổi dạy</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buổi dạy</DialogTitle>
          <DialogDescription>
            Giờ Việt Nam. Đơn giá hiện tại được lưu riêng cho buổi này.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {[
            {
              name: "class_id",
              label: "Lớp",
              items: classes.map((c) => ({ id: c.id, label: c.name })),
            },
            {
              name: "teacher_id",
              label: "Giảng viên",
              items: teachers.map((t) => ({ id: t.id, label: t.full_name })),
            },
          ].map((f) => (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={f.name}>{f.label} *</Label>
              <select
                id={f.name}
                name={f.name}
                required
                defaultValue=""
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="" disabled>
                  Chọn {f.label.toLowerCase()}
                </option>
                {f.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">
            Giảng viên cần có tài khoản đang hoạt động. Chưa biết đơn giá có
            thể để bổ sung sau, giáo viên vẫn check-in/check-out bình thường.
          </p>
          <div className="space-y-2">
            <Label htmlFor="teaching-date">Ngày dạy *</Label>
            <Input
              id="teaching-date"
              type="date"
              name="date"
              required
              defaultValue={today}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "start_time", label: "Bắt đầu" },
              { name: "end_time", label: "Kết thúc" },
            ].map((f) => (
              <div key={f.name} className="space-y-2">
                <Label htmlFor={f.name}>{f.label} *</Label>
                <Input id={f.name} name={f.name} type="time" required />
              </div>
            ))}
          </div>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          {state.fieldErrors && (
            <p role="alert" className="text-destructive">
              {Object.values(state.fieldErrors).flat().join(" ")}
            </p>
          )}
          <DialogFooter>
            <SubmitButton>Lưu buổi dạy</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
