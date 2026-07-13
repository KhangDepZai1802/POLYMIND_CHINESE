"use client";

import { Lock, MailPlus, MoreHorizontal, Unlock } from "lucide-react";

import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import {
  resendTeacherInviteAction,
  toggleTeacherActiveAction,
} from "@/features/teachers/server/actions";
import { Button } from "@/components/ui/button";
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
  profile: { full_name: string; phone: string | null; email: string | null } | null;
};

export function TeacherRowActions({ teacher }: { teacher: Teacher }) {
  const toggle = useFormAction(toggleTeacherActiveAction, { toastError: true });
  const invite = useFormAction(resendTeacherInviteAction, { toastError: true });

  return (
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

        {teacher.profile?.email && (
          <form action={invite.formAction}>
            <input type="hidden" name="email" value={teacher.profile.email} />
            <button
              type="submit"
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <MailPlus className="size-4" aria-hidden />
              Gửi lại lời mời
            </button>
          </form>
        )}

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
  );
}
