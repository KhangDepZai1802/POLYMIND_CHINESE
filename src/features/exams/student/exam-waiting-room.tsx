"use client";

import { useState } from "react";
import { startExamAction } from "@/features/exams/server/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function ExamWaitingRoom({ deliveryId, canStart }: { deliveryId: string; canStart: boolean }) {
  const [audioChecked, setAudioChecked] = useState(false);
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
  return (
    <Dialog>
      <DialogTrigger asChild><Button disabled={!canStart}>{canStart ? "Vào phòng chờ" : "Chưa đến giờ"}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Phòng chờ kỳ thi</DialogTitle><DialogDescription>Kiểm tra thiết bị trước khi bắt đầu. Timer chỉ chạy sau khi DB tạo lượt thi.</DialogDescription></DialogHeader>
        <div className="space-y-4 text-sm">
          <Button type="button" variant="outline" onClick={testAudio}>{audioChecked ? "✓ Đã phát âm thanh kiểm tra" : "Phát âm thanh kiểm tra"}</Button>
          <Label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Tôi hiểu bài thi không cho copy/cut/paste/drop; sự kiện chỉ được ghi để tham khảo và không tự động kết luận gian lận.</span></Label>
        </div>
        <DialogFooter>
          <form action={startExamAction}>
            <input type="hidden" name="delivery_id" value={deliveryId} />
            <Button type="submit" disabled={!audioChecked || !accepted}>Bắt đầu thi</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
