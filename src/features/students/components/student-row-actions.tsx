"use client";

import { useState } from "react";
import { Archive, MailPlus, MoreHorizontal } from "lucide-react";

import { StudentFormDialog } from "@/features/students/components/student-form-dialog";
import {
  archiveStudentAction,
  inviteStudentAction,
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
};

export function StudentRowActions({
  student,
  levels,
}: {
  student: Student;
  levels: Level[];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const archive = useFormAction(archiveStudentAction, { toastError: true });
  const invite = useFormAction(inviteStudentAction, {
    onSuccess: () => setInviteOpen(false),
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

          {!student.user_id && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setInviteOpen(true);
              }}
            >
              <MailPlus className="size-4" aria-hidden />
              Gửi lời mời tài khoản
            </DropdownMenuItem>
          )}

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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi lời mời tài khoản</DialogTitle>
            <DialogDescription>
              {student.full_name} sẽ nhận email và tự đặt mật khẩu.
            </DialogDescription>
          </DialogHeader>

          <form action={invite.formAction} className="space-y-4">
            <input type="hidden" name="id" value={student.id} />

            <div className="space-y-2">
              <Label htmlFor={`invite_email_${student.id}`}>Email *</Label>
              <Input
                id={`invite_email_${student.id}`}
                name="email"
                type="email"
                required
                defaultValue={student.email ?? ""}
                placeholder="hocvien@example.com"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton pendingText="Đang gửi…">Gửi lời mời</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
