"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  resetPasswordAction,
  type ActionState,
} from "@/features/auth/server/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu mới</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-muted-foreground text-xs">
              Ít nhất 8 ký tự.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
