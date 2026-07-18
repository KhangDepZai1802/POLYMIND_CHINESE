"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";

type CheckStatus = "idle" | "checking" | "ready" | "blocked";

function microphoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Trình duyệt đang chặn micro. Bấm biểu tượng ổ khóa hoặc micro cạnh thanh địa chỉ, chọn Cho phép, rồi bấm Kiểm tra lại.";
    }
    if (error.name === "NotFoundError") {
      return "Không tìm thấy micro. Hãy kết nối micro hoặc tai nghe có micro rồi kiểm tra lại.";
    }
    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "Micro đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi kiểm tra lại.";
    }
  }
  return "Không thể mở micro. Hãy kiểm tra quyền micro của trình duyệt rồi thử lại.";
}

export function MicrophoneCheck({
  onReadyChange,
  className = "",
}: {
  onReadyChange?: (ready: boolean) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [error, setError] = useState<string>();

  const check = async () => {
    setStatus("checking");
    setError(undefined);
    onReadyChange?.(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked");
      setError(
        "Trình duyệt này không hỗ trợ thu âm hoặc trang chưa dùng kết nối HTTPS an toàn. Hãy mở bằng Chrome, Edge hoặc Safari phiên bản mới.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus("ready");
      onReadyChange?.(true);
    } catch (caught) {
      setStatus("blocked");
      setError(microphoneError(caught));
    }
  };

  return (
    <div
      className={`space-y-3 rounded-lg border p-4 ${
        status === "ready"
          ? "border-emerald-500/50 bg-emerald-500/5"
          : status === "blocked"
            ? "border-destructive/50 bg-destructive/5"
            : "bg-muted/30"
      } ${className}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {status === "ready" ? (
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-emerald-600"
            aria-hidden
          />
        ) : status === "blocked" ? (
          <AlertTriangle
            className="text-destructive mt-0.5 size-5 shrink-0"
            aria-hidden
          />
        ) : (
          <Mic className="mt-0.5 size-5 shrink-0" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="font-medium">
            {status === "ready" ? "Micro đã sẵn sàng" : "Kiểm tra quyền micro"}
          </p>
          <p className="text-muted-foreground text-sm">
            {status === "ready"
              ? "Bạn có thể thu âm câu trả lời. Hệ thống đã đóng luồng kiểm tra và chưa ghi lại nội dung nào."
              : "Trình duyệt sẽ hỏi quyền một lần. Chọn Cho phép để làm các câu yêu cầu thu âm."}
          </p>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {status !== "ready" && (
        <Button
          type="button"
          variant={status === "blocked" ? "default" : "outline"}
          onClick={check}
          disabled={status === "checking"}
        >
          {status === "checking" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Mic className="size-4" aria-hidden />
          )}
          {status === "checking"
            ? "Đang kiểm tra…"
            : status === "blocked"
              ? "Kiểm tra lại"
              : "Cho phép & kiểm tra micro"}
        </Button>
      )}
    </div>
  );
}
