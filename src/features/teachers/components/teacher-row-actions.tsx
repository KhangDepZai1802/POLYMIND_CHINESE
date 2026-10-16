"use client";

import { KeyRound, Lock, MoreHorizontal, Unlock } from "lucide-react";
import { TeacherAccountDialog } from "./teacher-account-dialog";

import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import { toggleTeacherActiveAction } from "@/features/teachers/server/actions";
import { Button } from "@/components/ui/button";
import { useConfirmSubmit } from "@/components/shared/confirmation-provider";
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
  employment_type: "full_time" | "part_time" | null;
  hourly_rate: number | null;
  is_active: boolean;
  profile: {
    full_name: string;
    phone: string | null;
    email: string | null;
    username: string | null;
  } | null;
};

/**
 * `canManageAccounts` = người đang xem có quyền QUẢN TRỊ TÀI KHOẢN không.
 *
 * Giáo vụ (`academic_manager`) sửa được hồ sơ nhưng KHÔNG đặt lại mật khẩu và
 * KHÔNG khóa/mở tài khoản — `D-2` điểm (4). Hai server action tương ứng đã gác
 * bằng `requireRole("super_admin")`, nên bày nút ra không mở được cửa nào;
 * nhưng bày một nút mà bấm vào là bị đá về trang chủ thì tệ hơn là không bày.
 */
export function TeacherRowActions({
  teacher,
  canManageAccounts,
}: {
  teacher: Teacher;
  canManageAccounts: boolean;
}) {
  const toggle = useFormAction(toggleTeacherActiveAction, { toastError: true });
  const confirmToggle = useConfirmSubmit(
    {
      title: "Khóa tài khoản giáo viên?",
      description: `Khóa tài khoản của ${teacher.profile?.full_name}? Họ sẽ không đăng nhập được nữa.`,
      confirmLabel: "Khóa tài khoản",
      variant: "destructive",
    },
    teacher.is_active,
  );

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

          {canManageAccounts && (
            <TeacherAccountDialog
              target={{ kind: "teacher", id: teacher.id }}
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <KeyRound className="size-4" aria-hidden />
                  Đặt lại mật khẩu
                </DropdownMenuItem>
              }
            />
          )}

          {canManageAccounts && <DropdownMenuSeparator />}

          {canManageAccounts && (
            <form action={toggle.formAction} onSubmit={confirmToggle}>
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
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
