"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  resetPasswordAction,
  type ActionState,
} from "@/features/auth/server/actions";
import { AuthFormFeedback } from "@/features/auth/components/auth-form-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const ERROR_ID = "reset-password-error";
const HINT_ID = "reset-password-hint";

export function ResetPasswordForm({
  title = "Đặt lại mật khẩu",
  description = "Nhập mật khẩu mới cho tài khoản của bạn.",
  submitLabel = "Đặt lại mật khẩu",
}: {
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1 className="text-lg">{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <AuthFormFeedback
            isPending={isPending}
            error={state.error}
            errorId={ERROR_ID}
          />

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu mới</Label>
            <PasswordInput
              id="password"
              name="password"
              fieldLabel="mật khẩu mới"
              autoComplete="new-password"
              required
              minLength={8}
              // Luôn trỏ tới dòng yêu cầu độ dài, thêm lỗi vào khi có — đúng
              // cách `PasswordForm` của `/student/profile` đã làm ở M27. Bản cũ
              // để dòng "Ít nhất 8 ký tự." trôi nổi cạnh ô mà không nối vào ô
              // nào, nên trình đọc màn hình đọc tới ô mật khẩu là không nghe
              // thấy yêu cầu; người dùng chỉ biết luật sau khi bị chặn.
              aria-describedby={
                state.error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID
              }
            />
            {/* `text-sm` chứ không `text-xs`: đây là điều kiện phải đọc được
                TRƯỚC khi gõ, đo được 12px ở bản cũ. */}
            <p id={HINT_ID} className="text-muted-foreground text-sm">
              Ít nhất 8 ký tự.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              fieldLabel="ô nhập lại mật khẩu"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby={state.error ? ERROR_ID : undefined}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Đang lưu…" : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
