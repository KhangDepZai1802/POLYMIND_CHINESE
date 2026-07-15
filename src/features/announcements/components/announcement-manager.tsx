"use client";

import { useState } from "react";
import {
  CircleAlert,
  Megaphone,
  Pencil,
  Plus,
  Send,
  TimerOff,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  expireAnnouncementAction,
  publishAnnouncementAction,
  saveAnnouncementAction,
} from "@/features/announcements/server/actions";
import type {
  AnnouncementClassOption,
  AnnouncementRecord,
} from "@/features/announcements/types";
import { formatDateTime, toDateTimeInputValue } from "@/lib/dates";
import { useFormAction } from "@/lib/use-form-action";

export function AnnouncementManager({
  announcements,
  classes,
}: {
  announcements: AnnouncementRecord[];
  classes: AnnouncementClassOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AnnouncementDialog classes={classes} />
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Megaphone}
              title="Chưa có announcement"
              description="Soạn bản nháp, kiểm tra phạm vi rồi phát hành tới toàn hệ thống hoặc một lớp."
              action={<AnnouncementDialog classes={classes} />}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              classes={classes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function announcementState(announcement: AnnouncementRecord) {
  if (!announcement.published_at) {
    return { label: "Nháp", tone: "neutral" as const };
  }
  if (
    announcement.expires_at &&
    Date.parse(announcement.expires_at) <= Date.now()
  ) {
    return { label: "Hết hiệu lực", tone: "neutral" as const };
  }
  return { label: "Đang hiệu lực", tone: "success" as const };
}

function AnnouncementCard({
  announcement,
  classes,
}: {
  announcement: AnnouncementRecord;
  classes: AnnouncementClassOption[];
}) {
  const state = announcementState(announcement);
  const active = state.label === "Đang hiệu lực";

  return (
    <Card>
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{announcement.title}</CardTitle>
              <StatusBadge label={state.label} tone={state.tone} />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {announcement.class
                ? `${announcement.class.code} — ${announcement.class.name}`
                : "Toàn hệ thống"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!announcement.published_at && (
              <>
                <AnnouncementDialog
                  announcement={announcement}
                  classes={classes}
                />
                <AnnouncementAction
                  announcement={announcement}
                  action="publish"
                />
              </>
            )}
            {active && (
              <AnnouncementAction announcement={announcement} action="expire" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm whitespace-pre-wrap">{announcement.body}</p>
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>Tạo lúc {formatDateTime(announcement.created_at)}</p>
          {announcement.published_at && (
            <p>Phát hành {formatDateTime(announcement.published_at)}</p>
          )}
          {announcement.expires_at && (
            <p>Hết hạn {formatDateTime(announcement.expires_at)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnnouncementAction({
  announcement,
  action,
}: {
  announcement: AnnouncementRecord;
  action: "publish" | "expire";
}) {
  const serverAction =
    action === "publish" ? publishAnnouncementAction : expireAnnouncementAction;
  const { state, formAction } = useFormAction(serverAction, {
    toastError: true,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={announcement.id} />
      <Button
        type="submit"
        size="sm"
        variant={action === "publish" ? "default" : "outline"}
        title={state.error}
      >
        {action === "publish" ? <Send aria-hidden /> : <TimerOff aria-hidden />}
        {action === "publish" ? "Phát hành" : "Kết thúc"}
      </Button>
    </form>
  );
}

function AnnouncementDialog({
  classes,
  announcement,
}: {
  classes: AnnouncementClassOption[];
  announcement?: AnnouncementRecord;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(saveAnnouncementAction, {
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={announcement ? "ghost" : "default"}
          size={announcement ? "icon" : "default"}
        >
          {announcement ? (
            <>
              <Pencil aria-hidden />
              <span className="sr-only">Sửa {announcement.title}</span>
            </>
          ) : (
            <>
              <Plus aria-hidden />
              Soạn announcement
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {announcement ? "Sửa bản nháp" : "Soạn announcement"}
          </DialogTitle>
          <DialogDescription>
            Announcement là thông tin một chiều. Sau khi phát hành sẽ khóa nội
            dung để giữ lịch sử.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input
            type="hidden"
            name="announcement_id"
            value={announcement?.id ?? ""}
          />

          {state.error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`announcement-title-${announcement?.id ?? "new"}`}>
              Tiêu đề *
            </Label>
            <Input
              id={`announcement-title-${announcement?.id ?? "new"}`}
              name="title"
              required
              maxLength={200}
              defaultValue={announcement?.title ?? ""}
            />
            {state.fieldErrors?.title && (
              <p className="text-destructive text-xs">
                {state.fieldErrors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nơi nhận *</Label>
            <Select
              name="class_id"
              defaultValue={announcement?.class_id ?? "all"}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn hệ thống</SelectItem>
                {classes.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id}>
                    {classItem.code} — {classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.class_id && (
              <p className="text-destructive text-xs">
                {state.fieldErrors.class_id}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`announcement-body-${announcement?.id ?? "new"}`}>
              Nội dung *
            </Label>
            <Textarea
              id={`announcement-body-${announcement?.id ?? "new"}`}
              name="body"
              required
              rows={8}
              maxLength={5000}
              defaultValue={announcement?.body ?? ""}
            />
            {state.fieldErrors?.body && (
              <p className="text-destructive text-xs">
                {state.fieldErrors.body}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`announcement-expiry-${announcement?.id ?? "new"}`}>
              Hết hiệu lực lúc
            </Label>
            <Input
              id={`announcement-expiry-${announcement?.id ?? "new"}`}
              name="expires_at"
              type="datetime-local"
              defaultValue={toDateTimeInputValue(announcement?.expires_at)}
            />
            <p className="text-muted-foreground text-xs">
              Để trống nếu announcement không có hạn tự động.
            </p>
            {state.fieldErrors?.expires_at && (
              <p className="text-destructive text-xs">
                {state.fieldErrors.expires_at}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton pendingText="Đang lưu…">Lưu bản nháp</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
