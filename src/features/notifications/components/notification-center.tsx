"use client";

import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNotificationLink } from "@/features/notifications/links";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  saveNotificationPreferencesAction,
} from "@/features/notifications/server/actions";
import type {
  NotificationItem,
  NotificationPreference,
} from "@/features/notifications/types";
import { formatDateTime } from "@/lib/dates";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { UserRole } from "@/types/roles";

export function NotificationCenter({
  notifications,
  preferences,
  role,
}: {
  notifications: NotificationItem[];
  preferences: NotificationPreference[];
  role: UserRole;
}) {
  const unread = notifications.filter((item) => !item.read_at).length;
  const markAll = useFormAction(markAllNotificationsReadAction, {
    toastError: true,
  });
  const savePreferences = useFormAction(saveNotificationPreferencesAction);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" aria-hidden />
              Danh sách thông báo
              {unread > 0 && (
                <StatusBadge label={`${unread} chưa đọc`} tone="info" />
              )}
            </CardTitle>
            {unread > 0 && (
              <form action={markAll.formAction}>
                <Button type="submit" size="sm" variant="outline">
                  <CheckCheck aria-hidden />
                  Đánh dấu tất cả đã đọc
                </Button>
              </form>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Chưa có thông báo"
              description="Các cập nhật liên quan đến tài khoản của bạn sẽ xuất hiện tại đây."
            />
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  role={role}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4" aria-hidden />
            Tùy chọn in-app
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Tắt một loại sẽ ngăn các thông báo mới thuộc loại đó. Email chưa
            được triển khai trong phiên bản này.
          </p>
        </CardHeader>
        <CardContent>
          <form action={savePreferences.formAction} className="space-y-4">
            {savePreferences.state.error && (
              <p className="text-destructive text-sm">
                {savePreferences.state.error}
              </p>
            )}
            <div className="space-y-3">
              {preferences.map((preference) => (
                <label
                  key={preference.type}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                >
                  <span>{NOTIFICATION_TYPE_LABELS[preference.type]}</span>
                  <input
                    type="checkbox"
                    name={preference.type}
                    defaultChecked={preference.in_app_enabled}
                    className="accent-primary size-4"
                  />
                </label>
              ))}
            </div>
            <SubmitButton className="w-full">Lưu tùy chọn</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  role,
}: {
  notification: NotificationItem;
  role: UserRole;
}) {
  const markRead = useFormAction(markNotificationReadAction, {
    toastError: true,
  });
  const unread = !notification.read_at;
  const link = safeNotificationLink(notification.link, role);

  return (
    <li className={unread ? "bg-primary/5 px-5 py-4" : "px-5 py-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{notification.title}</p>
            <span className="text-muted-foreground text-xs">
              {NOTIFICATION_TYPE_LABELS[notification.type]}
            </span>
          </div>
          {notification.body && (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
              {notification.body}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {formatDateTime(notification.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {link && (
            <Button asChild size="sm" variant="outline">
              <Link href={link}>
                <ExternalLink aria-hidden />
                Xem
              </Link>
            </Button>
          )}
          {unread && (
            <form action={markRead.formAction}>
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
