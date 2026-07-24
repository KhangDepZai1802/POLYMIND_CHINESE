"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  forgotPasswordAction,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_ID = "forgot-password-error";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1 className="text-lg">Quên mật khẩu</h1>
        </CardTitle>
        <CardDescription>
          Nhập email của bạn. Chúng tôi sẽ gửi link đặt lại mật khẩu.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {/* Thông báo thành công cũng phải nhận tiêu điểm, không chỉ thông báo
              lỗi: `forgotPasswordAction` luôn trả cùng một câu "Nếu email tồn
              tại…" (cố ý, để không lộ email nào có trong hệ thống), nên màn
              hình gần như không đổi gì sau khi gửi. Không đưa tiêu điểm vào đó
              thì người dùng bàn phím không biết đã gửi xong hay chưa. */}
          <AuthFormFeedback
            isPending={isPending}
            error={state.error}
            success={state.success}
            errorId={ERROR_ID}
          />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="ten@polymind.vn"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? ERROR_ID : undefined}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Đang gửi…" : "Gửi link đặt lại"}
          </Button>

          <p className="text-center text-sm">
            {/* `py-1` chứ không `min-h-6` — xem ghi chú dài ở `login-form.tsx`:
                utility `min-h-*` thắng luật 44px của `globals.css` vì khác
                @layer, và làm hụt touch target trên cảm ứng. */}
            <Link
              href="/login"
              className="text-primary focus-visible:ring-ring/50 inline-flex items-center rounded-sm py-1 hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
            >
              Quay lại đăng nhập
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
