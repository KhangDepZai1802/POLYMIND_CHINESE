"use client";

import { KeyRound, Lock, MoreHorizontal, Unlock } from "lucide-react";
import { useState } from "react";

import type { AccountRow } from "@/features/accounts/server/queries";
import {
  toggleAccountActiveAction,
  updateAccountCredentialsAction,
} from "@/features/accounts/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { useConfirmSubmit } from "@/components/shared/confirmation-provider";
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

/**
 * Thao tác trên một tài khoản: đổi tên đăng nhập + đặt lại mật khẩu, khóa/mở.
 *
 * `isSelf` = dòng của chính người đang đăng nhập → ẩn nút khóa (server cũng chặn,
 * nhưng ẩn ở đây cho khỏi bấm nhầm).
 */
export function AccountRowActions({
  account,
  isSelf,
}: {
  account: AccountRow;
  isSelf: boolean;
}) {
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const toggle = useFormAction(toggleAccountActiveAction, { toastError: true });
  const credentials = useFormAction(updateAccountCredentialsAction, {
    onSuccess: () => setCredentialsOpen(false),
    toastError: true,
  });
  const confirmToggle = useConfirmSubmit(
    {
      title: "Khóa tài khoản?",
      description: `Khóa tài khoản của ${account.full_name}? Họ sẽ không đăng nhập được nữa.`,
      confirmLabel: "Khóa tài khoản",
      variant: "destructive",
    },
    account.is_active,
  );

  const fe = credentials.state.fieldErrors ?? {};

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Thao tác tài khoản">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setCredentialsOpen(true);
            }}
          >
            <KeyRound className="size-4" aria-hidden />
            Đổi đăng nhập / mật khẩu
          </DropdownMenuItem>

          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <form action={toggle.formAction} onSubmit={confirmToggle}>
                <input type="hidden" name="user_id" value={account.id} />
                <input
                  type="hidden"
                  name="activate"
                  value={account.is_active ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  {account.is_active ? (
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi thông tin đăng nhập</DialogTitle>
            <DialogDescription>
              Đặt tên đăng nhập và mật khẩu mới cho {account.full_name}. Mật
              khẩu cũ không hiển thị lại được — nhập mật khẩu mới rồi đưa cho
              họ.
            </DialogDescription>
          </DialogHeader>
          <form action={credentials.formAction} className="space-y-4">
            <input type="hidden" name="user_id" value={account.id} />
            <div className="space-y-2">
              <Label htmlFor={`account_username_${account.id}`}>
                Tên đăng nhập
              </Label>
              <Input
                id={`account_username_${account.id}`}
                name="username"
                defaultValue={account.username ?? ""}
                autoComplete="off"
                required
              />
              {fe["username"] && (
                <p className="text-destructive text-xs">{fe["username"]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`account_password_${account.id}`}>
                Mật khẩu mới
              </Label>
              <Input
                id={`account_password_${account.id}`}
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
