"use client";

import { KeyRound, Lock, MoreHorizontal, Unlock } from "lucide-react";
import { useState } from "react";

import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import {
  resetTeacherPasswordAction,
  toggleTeacherActiveAction,
} from "@/features/teachers/server/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormAction } from "@/lib/use-form-action";

type Teacher = {
  id: string;
  teacher_code: string;
  specialization: string | null;
  bio: string | null;
  is_active: boolean;
  profile: {
    full_name: string;
    phone: string | null;
    email: string | null;
    username: string | null;
  } | null;
};

export function TeacherRowActions({ teacher }: { teacher: Teacher }) {
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const toggle = useFormAction(toggleTeacherActiveAction, { toastError: true });
  const credentials = useFormAction(resetTeacherPasswordAction, {
    onSuccess: () => setCredentialsOpen(false),
    toastError: true,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Thao tác">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <TeacherFormDialog
            teacher={teacher}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Sửa hồ sơ
              </DropdownMenuItem>
            }
          />

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setCredentialsOpen(true);
            }}
          >
            <KeyRound className="size-4" aria-hidden />
            Đặt lại mật khẩu
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <form
            action={toggle.formAction}
            onSubmit={(e) => {
              if (
                teacher.is_active &&
                !window.confirm(
                  `Khóa tài khoản của ${teacher.profile?.full_name}? Họ sẽ không đăng nhập được nữa.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={teacher.id} />
            <input
              type="hidden"
              name="activate"
              value={teacher.is_active ? "false" : "true"}
            />
            <button
              type="submit"
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              {teacher.is_active ? (
                <>
                  <Lock className="text-destructive size-4" aria-hidden />
                  <span className="text-destructive">Khóa tài khoản</span>
                </>
              ) : (
                <>
                  <Unlock className="size-4" aria-hidden />
                  Mở khóa tài khoản
                </>
              )}
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật tài khoản giáo viên</DialogTitle>
            <DialogDescription>
              Đặt tên đăng nhập và mật khẩu mới cho {teacher.profile?.full_name}
              .
            </DialogDescription>
          </DialogHeader>
          <form action={credentials.formAction} className="space-y-4">
            <input type="hidden" name="id" value={teacher.id} />
            <div className="space-y-2">
              <Label htmlFor={`teacher_username_${teacher.id}`}>
                Tên đăng nhập
              </Label>
              <Input
                id={`teacher_username_${teacher.id}`}
                name="username"
                defaultValue={teacher.profile?.username ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`teacher_password_${teacher.id}`}>
                Mật khẩu mới
              </Label>
              <Input
                id={`teacher_password_${teacher.id}`}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCredentialsOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton pendingText="Đang cập nhật…">Cập nhật</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
