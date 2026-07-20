"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/shared/confirmation-provider";

export type SpeakingRecorderStatus =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "saved"
  | "device_error"
  | "upload_error";

/** Chọn mime MediaRecorder hỗ trợ; ưu tiên webm/opus, rơi về mp4 cho Safari. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * P-C — Ghi âm bài Nói ngay trên web (MediaRecorder), phát lại rồi nộp.
 * `disabled` = xem trước ở wizard (không thu âm). `existingUrl` = bản đã nộp
 * (signed URL) để học viên nghe lại. `onUpload` nhận blob + thời lượng ms.
 * Không giới hạn/auto-dừng: học viên tự bấm Dừng; chỉ hiển thị thời lượng.
 */
export function SpeakingRecorder({
  existingUrl,
  disabled = false,
  onUpload,
  onDelete,
  onStatusChange,
}: {
  existingUrl?: string | null;
  disabled?: boolean;
  onUpload?: (
    blob: Blob,
    durationMs: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: () => Promise<{ ok: boolean; error?: string }>;
  onStatusChange?: (status: SpeakingRecorderStatus) => void;
}) {
  const confirm = useConfirmation();
  const [status, setStatus] = useState<SpeakingRecorderStatus>(
    existingUrl ? "saved" : "idle",
  );
  const [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const [recordedSec, setRecordedSec] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingUrl ?? null,
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const durationRef = useRef(0);
  const startedAtRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };
  const releaseObjectUrl = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearTick();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      releaseObjectUrl();
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const uploadBlob = async (blob: Blob, durationMs: number) => {
    if (!onUpload) return;
    setStatus("uploading");
    setError(undefined);
    try {
      const result = await onUpload(blob, durationMs);
      if (result.ok) {
        setStatus("saved");
        return;
      }
      setError(result.error ?? "Không nộp được bản ghi.");
      setStatus("upload_error");
    } catch {
      setError("Mất kết nối khi tải bản ghi. Hãy bấm thử lại.");
      setStatus("upload_error");
    }
  };

  const stop = () => {
    clearTick();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startRecording = async () => {
    setError(undefined);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Trình duyệt không hỗ trợ thu âm.");
      setStatus("device_error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      const blocked =
        caught instanceof DOMException &&
        ["NotAllowedError", "SecurityError"].includes(caught.name);
      setError(
        blocked
          ? "Micro đang bị chặn. Bấm biểu tượng ổ khóa hoặc micro cạnh thanh địa chỉ, chọn Cho phép, rồi bấm Thu âm lại."
          : "Không mở được micro. Hãy đóng ứng dụng khác đang dùng micro rồi thử lại.",
      );
      setStatus("device_error");
      return;
    }
    const mimeType = pickMime();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      durationRef.current = Date.now() - startedAtRef.current;
      setRecordedSec(Math.round(durationRef.current / 1000));
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      blobRef.current = blob;
      releaseObjectUrl();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setStatus("recorded");
      if (onUpload) void uploadBlob(blob, durationRef.current);
    };
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start();
    setStatus("recording");
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
  };

  const upload = async () => {
    if (!blobRef.current || !onUpload) return;
    await uploadBlob(blobRef.current, durationRef.current);
  };

  const resetLocal = () => {
    blobRef.current = null;
    durationRef.current = 0;
    releaseObjectUrl();
    setPreviewUrl(null);
    setElapsed(0);
    setRecordedSec(null);
    setError(undefined);
    setStatus("idle");
  };

  // Xóa bản thu chưa nộp = chỉ dọn cục bộ. Xóa bản đã nộp = gọi server rồi dọn.
  const discard = async () => {
    if (status === "saved" && onDelete) {
      const accepted = await confirm({
        title: "Xóa bản ghi đã nộp?",
        description: "Bản ghi hiện tại sẽ bị xóa để bạn thu âm lại từ đầu.",
        confirmLabel: "Xóa & thu lại",
        variant: "destructive",
      });
      if (!accepted) return;
      setStatus("uploading");
      const result = await onDelete();
      if (!result.ok) {
        setError(result.error ?? "Không xóa được bản ghi.");
        setStatus("upload_error");
        return;
      }
    }
    resetLocal();
  };

  if (disabled) {
    return (
      <div className="text-muted-foreground bg-muted/40 rounded-lg border border-dashed p-4 text-sm">
        🎙️ Học viên sẽ thu âm trả lời ở đây. Giáo viên nghe và chấm tay.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-3">
        {status === "recording" ? (
          <>
            <Button type="button" variant="destructive" onClick={stop}>
              ⏹ Dừng thu
            </Button>
            <span className="text-destructive font-mono text-sm">
              ● Đang ghi {formatClock(elapsed)}
            </span>
          </>
        ) : (
          <Button
            type="button"
            variant={status.endsWith("_error") ? "default" : "outline"}
            onClick={startRecording}
            disabled={status === "uploading"}
          >
            🎙️ {status === "idle" ? "Bắt đầu thu âm" : "Thu âm lại"}
          </Button>
        )}
      </div>

      {previewUrl && status !== "recording" && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Nghe lại bản ghi
            {recordedSec !== null
              ? ` · độ dài ${formatClock(recordedSec)}`
              : ""}
            :
          </p>
          <audio
            controls
            preload="metadata"
            src={previewUrl}
            className="w-full"
          >
            <track kind="captions" />
          </audio>
        </div>
      )}

      {status === "recorded" && (
        <div className="flex flex-wrap gap-2">
          {onUpload && <p className="text-muted-foreground text-sm">Đang chuẩn bị tải bản ghi…</p>}
          <Button type="button" variant="outline" onClick={discard}>
            🗑 Xóa & thu lại
          </Button>
        </div>
      )}
      {status === "uploading" && (
        <p className="text-muted-foreground text-sm">Đang xử lý bản ghi…</p>
      )}
      {status === "saved" && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-emerald-700">✓ Đã nộp bản ghi.</p>
          <Button type="button" variant="outline" size="sm" onClick={discard}>
            🗑 Xóa & thu lại
          </Button>
        </div>
      )}
      {status === "upload_error" && previewUrl && onUpload && (
        <Button type="button" variant="outline" onClick={upload}>
          Thử tải lại bản ghi
        </Button>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
