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

/**
 * Lỗi của một ô nhập.
 *
 * `role="alert"` + `id` là bắt buộc: không có chúng thì trình đọc màn hình
 * không đọc lỗi lên, và ô nhập không có gì để `aria-describedby` trỏ tới.
 * Đây đúng mẫu đã sửa ở `M14-S03` (`session-log-form.tsx`).
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  ) : null;
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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="flex items-center gap-2 text-base">
            <span className="bg-student-sky-surface text-student-sky-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <UserRound className="size-4" aria-hidden />
            </span>
            Thông tin liên hệ
          </h2>
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
              // Phản chiếu đúng giới hạn của `contactSchema` phía server
              // (2–120 ký tự), không tạo luật validation mới — nguyên tắc
              // đã chốt ở `DS-021`.
              maxLength={120}
              defaultValue={fullName}
              aria-invalid={errors["full_name"] ? true : undefined}
              aria-describedby={
                errors["full_name"] ? "full_name-error" : undefined
              }
            />
            <FieldError id="full_name-error" message={errors["full_name"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              name="phone"
              maxLength={20}
              defaultValue={phone ?? ""}
              aria-invalid={errors["phone"] ? true : undefined}
              aria-describedby={errors["phone"] ? "phone-error" : undefined}
            />
            <FieldError id="phone-error" message={errors["phone"]} />
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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="flex items-center gap-2 text-base">
            <span className="bg-student-amber-surface text-student-amber-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <KeyRound className="size-4" aria-hidden />
            </span>
            Đổi mật khẩu
          </h2>
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
              maxLength={72}
              autoComplete="new-password"
              aria-invalid={errors["password"] ? true : undefined}
              // Luôn trỏ tới dòng yêu cầu độ dài; thêm lỗi vào khi có.
              // Trước đây `minLength={8}` chỉ nằm trong thuộc tính HTML nên
              // người dùng chỉ biết luật sau khi bị trình duyệt chặn.
              aria-describedby={
                errors["password"]
                  ? "password-hint password-error"
                  : "password-hint"
              }
            />
            <p id="password-hint" className="text-text-secondary text-sm">
              Tối thiểu 8 ký tự.
            </p>
            <FieldError id="password-error" message={errors["password"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Nhập lại mật khẩu mới</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              maxLength={72}
              autoComplete="new-password"
              aria-invalid={errors["confirm"] ? true : undefined}
              aria-describedby={errors["confirm"] ? "confirm-error" : undefined}
            />
            <FieldError id="confirm-error" message={errors["confirm"]} />
          </div>

          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
