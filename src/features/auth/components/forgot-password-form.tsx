"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import {
  forgotPasswordAction,
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

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quên mật khẩu</CardTitle>
        <CardDescription>
          Nhập email của bạn. Chúng tôi sẽ gửi link đặt lại mật khẩu.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state.success && (
            <Alert>
              <CheckCircle2 className="size-4" aria-hidden />
              <AlertDescription>{state.success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ten@polymind.vn"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Đang gửi…" : "Gửi link đặt lại"}
          </Button>

          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Quay lại đăng nhập
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
