"use client";

import { useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { remindTeacherReportAction } from "../server/actions";

/**
 * Nhắc giáo viên gửi báo cáo.
 *
 * Bấm nhiều lần trong cùng một ngày KHÔNG sinh nhiều thông báo — `dedupe_key`
 * ở DB có ngày trong đó nên lần thứ hai trả về "hôm nay đã nhắc rồi". Người
 * dùng vẫn nhận phản hồi rõ ràng thay vì im lặng.
 */
export function RemindTeacherButton({
  sessionId,
  label = "Nhắc giáo viên",
}: {
  sessionId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const body = new FormData();
          body.set("session_id", sessionId);
          const result = await remindTeacherReportAction(body);
          if (result.error) toast.error(result.error);
          else toast.success(result.success ?? "Đã gửi lời nhắc.");
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Bell className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  );
}
