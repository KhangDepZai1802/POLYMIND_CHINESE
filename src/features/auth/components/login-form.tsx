"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2, User, Headset, Lock } from "lucide-react";

import { loginAction, type ActionState } from "@/features/auth/server/actions";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

const ERROR_ID = "login-error";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    loginAction,
    { error: initialError },
  );

  const invalid = state.error ? { "aria-invalid": true as const } : {};
  const [identifier, setIdentifier] = useState("");

  return (
    <Card className="rounded-[1.75rem] border border-white/90 bg-white p-6 shadow-[0_15px_40px_-12px_rgba(16,36,63,0.1)] sm:p-8">
      <CardHeader className="p-0 pb-5">
        <div>
          <CardTitle asChild>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Đăng nhập
            </h1>
          </CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-normal text-slate-500">
            Chào mừng bạn quay trở lại!
            <br />
            Đăng nhập để tiếp tục sử dụng hệ thống.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <form action={formAction} className="space-y-3.5">
          <AuthFormFeedback
            isPending={isPending}
            error={state.error}
            errorId={ERROR_ID}
          />

          <div className="space-y-1.5">
            <Label
              htmlFor="identifier"
              className="text-xs font-semibold text-slate-700"
            >
              Tên đăng nhập
            </Label>
            <div className="relative">
              <User className="absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400" />
              <Input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="Nhập tên đăng nhập của bạn"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                {...invalid}
                aria-describedby={state.error ? ERROR_ID : undefined}
                className="focus-visible:ring-primary-500 h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-slate-700"
              >
                Mật khẩu
              </Label>
              <Link
                href="/forgot-password"
                className="text-primary-600 hover:text-primary-700 text-xs font-semibold hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3.5 z-10 size-4.5 -translate-y-1/2 text-slate-400" />
              <PasswordInput
                id="password"
                name="password"
                fieldLabel="mật khẩu"
                autoComplete="current-password"
                required
                placeholder="Nhập mật khẩu"
                {...invalid}
                aria-describedby={state.error ? ERROR_ID : undefined}
                className="focus-visible:ring-primary-500 h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 py-0.5">
            <Checkbox
              id="remember"
              name="remember"
              className="data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 size-4 rounded border-slate-300"
            />
            <label
              htmlFor="remember"
              className="cursor-pointer text-xs font-medium text-slate-700 select-none"
            >
              Ghi nhớ đăng nhập
            </label>
          </div>

          <Button
            type="submit"
            className="bg-primary-600 shadow-primary-600/20 hover:bg-primary-700 h-11 w-full rounded-xl text-sm font-bold text-white shadow-md transition"
            disabled={isPending}
          >
            {isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[11px] font-medium text-slate-400">
                Hoặc liên hệ hỗ trợ
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-sky-100/60 bg-sky-50/50 p-3">
            <div className="text-primary-600 flex size-9 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-white shadow-xs">
              <Headset className="size-4.5" />
            </div>
            <div>
              <h2 className="text-primary-700 text-xs font-bold">
                Chưa có tài khoản?
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Liên hệ quản trị viên của trung tâm để được cấp.
              </p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
