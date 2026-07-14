"use client";

import { AlertCircle, Bell, KeyRound, UserRound } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeMyPasswordAction,
  markNotificationReadAction,
  updateMyContactAction,
} from "@/features/student/server/profile-actions";
import { formatDateTime } from "@/lib/dates";
import { useFormAction } from "@/lib/use-form-action";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

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

export function NotificationList({
  notifications,
}: {
  notifications: Notification[];
}) {
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" aria-hidden />
            Thông báo ({notifications.length})
          </CardTitle>
          {unread > 0 && (
            <StatusBadge label={`${unread} chưa đọc`} tone="info" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Chưa có thông báo"
            description="Bài tập mới, kết quả và đánh giá sẽ được báo tại đây."
          />
        ) : (
          <ul className="divide-y">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const { formAction } = useFormAction(markNotificationReadAction, {
    toastError: true,
  });
  const unread = !notification.read_at;

  return (
    <li className={unread ? "bg-primary/5 px-5 py-3" : "px-5 py-3"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{notification.title}</p>
          {notification.body && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {notification.body}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {formatDateTime(notification.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notification.link && (
            <Button asChild size="sm" variant="outline">
              <a href={notification.link}>Xem</a>
            </Button>
          )}
          {unread && (
            <form action={formAction}>
              <input type="hidden" name="id" value={notification.id} />
              <Button type="submit" size="sm" variant="ghost">
                Đã đọc
              </Button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
