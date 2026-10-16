"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  prepareMeetingCheckin,
  priceTeachingSession,
} from "../server/teaching-actions";

export function TeachingSetup({
  meetingId,
  sessionId,
}: {
  meetingId?: string;
  sessionId?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function run(form?: FormData) {
    start(async () => {
      const result = meetingId
        ? await prepareMeetingCheckin(meetingId)
        : await priceTeachingSession(form!);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success);
        router.refresh();
      }
    });
  }
  if (meetingId)
    return (
      <Button disabled={pending} onClick={() => run()}>
        {pending ? "Đang mở…" : "Mở check-in"}
      </Button>
    );
  return (
    <form action={run} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={sessionId} />
      <Input
        aria-label="Đơn giá cho buổi dạy"
        name="rate"
        type="number"
        min="0"
        max="999999999999"
        step="1"
        required
        placeholder="Đơn giá / giờ"
      />
      <Button size="sm" disabled={pending}>
        Lưu đơn giá buổi này
      </Button>
    </form>
  );
}
