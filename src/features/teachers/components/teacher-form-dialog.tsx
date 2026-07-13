"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import {
  createTeacherAction,
  updateTeacherAction,
} from "@/features/teachers/server/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";

type Teacher = {
  id: string;
  teacher_code: string;
  specialization: string | null;
  bio: string | null;
  profile: { full_name: string; phone: string | null; email: string | null } | null;
};

export function TeacherFormDialog({
  teacher,
  trigger,
}: {
  teacher?: Teacher;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(teacher);
  const [open, setOpen] = useState(false);

  const { state, formAction } = useFormAction(
    isEdit ? updateTeacherAction : createTeacherAction,
    { onSuccess: () => setOpen(false) },
  );

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            Thêm giáo viên
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa hồ sơ giáo viên" : "Thêm giáo viên"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Email đăng nhập không đổi được ở đây."
              : "Hệ thống sẽ gửi email mời để giáo viên tự đặt mật khẩu."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={teacher!.id} />}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="giaovien@polymind.vn"
              />
              <p className="text-muted-foreground text-xs">
                Lời mời sẽ được gửi tới địa chỉ này.
              </p>
              {fe["email"] && (
                <p className="text-destructive text-xs">{fe["email"]}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Họ tên *</Label>
              <Input
                id="full_name"
                name="full_name"
                required
                defaultValue={teacher?.profile?.full_name}
              />
              {fe["full_name"] && (
                <p className="text-destructive text-xs">{fe["full_name"]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher_code">Mã giáo viên *</Label>
              <Input
                id="teacher_code"
                name="teacher_code"
                required
                defaultValue={teacher?.teacher_code}
                placeholder="GV001"
                className="uppercase"
              />
              {fe["teacher_code"] && (
                <p className="text-destructive text-xs">{fe["teacher_code"]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={teacher?.profile?.phone ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialization">Chuyên môn</Label>
            <Input
              id="specialization"
              name="specialization"
              defaultValue={teacher?.specialization ?? ""}
              placeholder="HSK, Tiếng Trung thương mại"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Giới thiệu</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={teacher?.bio ?? ""}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton pendingText={isEdit ? "Đang lưu…" : "Đang gửi lời mời…"}>
              {isEdit ? "Lưu thay đổi" : "Tạo & gửi lời mời"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
