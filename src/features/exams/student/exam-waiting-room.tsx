"use client";

import { useState } from "react";
import { CheckCircle2, Headphones, Mic2, ShieldCheck } from "lucide-react";
import { MicrophoneCheck } from "@/components/shared/microphone-check";
import { SubmitButton } from "@/components/shared/submit-button";
import { startExamAction } from "@/features/exams/server/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function ExamWaitingRoom({
  deliveryId,
  canStart,
  requiresMicrophone,
}: {
  deliveryId: string;
  canStart: boolean;
  requiresMicrophone: boolean;
}) {
  const [audioChecked, setAudioChecked] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const testAudio = () => {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    setAudioChecked(true);
  };
  const enterFocusMode = () => {
    if (!document.fullscreenElement) {
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => undefined);
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canStart}>
          {canStart ? "Vào phòng chờ" : "Chưa đến giờ"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Phòng chờ kỳ thi</DialogTitle>
          <DialogDescription>
            Kiểm tra thiết bị trước khi bắt đầu. Timer chỉ chạy sau khi DB tạo
            lượt thi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <WaitingStep
            icon={Headphones}
            title="1. Kiểm tra âm thanh"
            tone="sky"
          >
            <Button type="button" variant="outline" onClick={testAudio}>
              {audioChecked && <CheckCircle2 className="size-4" aria-hidden />}
              {audioChecked
                ? "Đã phát âm thanh kiểm tra"
                : "Phát âm thanh kiểm tra"}
            </Button>
          </WaitingStep>
          {requiresMicrophone && (
            <WaitingStep icon={Mic2} title="2. Kiểm tra micro" tone="cyan">
              <MicrophoneCheck onReadyChange={setMicrophoneReady} />
            </WaitingStep>
          )}
          <WaitingStep
            icon={ShieldCheck}
            title={`${requiresMicrophone ? "3" : "2"}. Xác nhận quy định`}
            tone="amber"
          >
            <Label className="flex items-start gap-3 leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                Tôi hiểu bài thi không cho copy/cut/paste/drop; sự kiện chỉ được
                ghi để tham khảo và không tự động kết luận gian lận.
              </span>
            </Label>
          </WaitingStep>
        </div>
        <DialogFooter>
          <form action={startExamAction} onSubmit={enterFocusMode}>
            <input type="hidden" name="delivery_id" value={deliveryId} />
            <SubmitButton
              pendingText="Đang mở bài thi…"
              disabled={
                !audioChecked ||
                !accepted ||
                (requiresMicrophone && !microphoneReady)
              }
            >
              Bắt đầu thi
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WaitingStep({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof Headphones;
  title: string;
  tone: "sky" | "cyan" | "amber";
  children: React.ReactNode;
}) {
  const style = {
    sky: "border-student-sky-border bg-student-sky-surface text-student-sky-ink",
    cyan: "border-student-cyan-border bg-student-cyan-surface text-student-cyan-ink",
    amber:
      "border-student-amber-border bg-student-amber-surface text-student-amber-ink",
  }[tone];
  return (
    <section className={`${style} space-y-3 rounded-xl border p-3`}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4" aria-hidden />
        {title}
      </h3>
      <div className="text-foreground">{children}</div>
    </section>
  );
}
