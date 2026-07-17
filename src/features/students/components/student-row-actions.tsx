"use client";

import { useState } from "react";
import { Archive, KeyRound, MoreHorizontal, UserPlus } from "lucide-react";

import { StudentFormDialog } from "@/features/students/components/student-form-dialog";
import {
  archiveStudentAction,
  provisionStudentAccountAction,
} from "@/features/students/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/lib/use-form-action";

type Level = { id: string; code: string; name: string };

type Student = NonNullable<
  React.ComponentProps<typeof StudentFormDialog>["student"]
> & {
  user_id: string | null;
  profile: {
    username: string | null;
    email: string | null;
    is_active: boolean;
  } | null;
};

export function StudentRowActions({
  student,
  levels,
}: {
  student: Student;
  levels: Level[];
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  const archive = useFormAction(archiveStudentAction, { toastError: true });
  const account = useFormAction(provisionStudentAccountAction, {
    onSuccess: () => setAccountOpen(false),
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
          <StudentFormDialog
            levels={levels}
            student={student}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Sửa hồ sơ
              </DropdownMenuItem>
            }
          />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAccountOpen(true);
            }}
          >
            {student.user_id ? (
              <KeyRound className="size-4" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            {student.user_id ? "Đặt lại mật khẩu" : "Cấp tài khoản"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <form
            action={archive.formAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Lưu trữ hồ sơ "${student.full_name}"? Dữ liệu học tập được giữ nguyên, chỉ ẩn khỏi danh sách đang học.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={student.id} />
            <button
              type="submit"
              className="hover:bg-accent text-destructive flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <Archive className="size-4" aria-hidden />
              Lưu trữ hồ sơ
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {student.user_id ? "Cập nhật tài khoản" : "Cấp tài khoản"}
            </DialogTitle>
            <DialogDescription>
              Quản trị viên đặt tên đăng nhập và mật khẩu trực tiếp cho{" "}
              {student.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form action={account.formAction} className="space-y-4">
            <input type="hidden" name="id" value={student.id} />

            <div className="space-y-2">
              <Label htmlFor={`account_username_${student.id}`}>
                Tên đăng nhập *
              </Label>
              <Input
                id={`account_username_${student.id}`}
                name="username"
                required
                defaultValue={student.profile?.username ?? ""}
                placeholder="Ví dụ: hv.an"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`account_password_${student.id}`}>
                Mật khẩu {student.user_id ? "mới" : "ban đầu"} *
              </Label>
              <Input
                id={`account_password_${student.id}`}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`account_email_${student.id}`}>
                Email liên hệ
              </Label>
              <Input
                id={`account_email_${student.id}`}
                name="email"
                type="email"
                defaultValue={student.email ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                Không bắt buộc và không dùng làm tên đăng nhập.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton pendingText="Đang cập nhật…">
                {student.user_id ? "Cập nhật" : "Cấp tài khoản"}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
