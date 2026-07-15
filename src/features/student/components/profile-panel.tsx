"use client";

import { AlertCircle, KeyRound, UserRound } from "lucide-react";

import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeMyPasswordAction,
  updateMyContactAction,
} from "@/features/student/server/profile-actions";
import { useFormAction } from "@/lib/use-form-action";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function ContactForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const { state, formAction } = useFormAction(updateMyContactAction);
  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" aria-hidden />
          Thông tin liên hệ
        </CardTitle>
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
            <Label htmlFor="full_name">Họ và tên</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={fullName}
            />
            <FieldError message={errors["full_name"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" name="phone" defaultValue={phone ?? ""} />
            <FieldError message={errors["phone"]} />
          </div>

          <SubmitButton>Lưu thay đổi</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const { state, formAction } = useFormAction(changeMyPasswordAction);
  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" aria-hidden />
          Đổi mật khẩu
        </CardTitle>
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
              required
              minLength={8}
              autoComplete="new-password"
            />
            <FieldError message={errors["password"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Nhập lại mật khẩu mới</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
            />
            <FieldError message={errors["confirm"]} />
          </div>

          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
