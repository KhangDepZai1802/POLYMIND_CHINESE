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
  profile: {
    full_name: string;
    phone: string | null;
    email: string | null;
    username: string | null;
  } | null;
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
              ? "Thông tin đăng nhập được quản lý ở menu thao tác tài khoản."
              : "Cấp tên đăng nhập và mật khẩu trực tiếp cho giáo viên."}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Tên đăng nhập *</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="off"
                  required
                />
                {fe["username"] && (
                  <p className="text-destructive text-xs">{fe["username"]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu ban đầu *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {fe["password"] && (
                  <p className="text-destructive text-xs">{fe["password"]}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email liên hệ</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={teacher?.profile?.email ?? ""}
              disabled={isEdit}
            />
            <p className="text-muted-foreground text-xs">
              Không bắt buộc và không dùng làm tên đăng nhập.
            </p>
          </div>

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

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Mã giáo viên được hệ thống tự sinh sau khi lưu.
            </p>
          )}

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
            <SubmitButton
              pendingText={isEdit ? "Đang lưu…" : "Đang tạo tài khoản…"}
            >
              {isEdit ? "Lưu thay đổi" : "Tạo & cấp tài khoản"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
