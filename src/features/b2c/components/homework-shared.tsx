"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { B2C_HOMEWORK_MAX_BYTES } from "../domain/homework";
import {
  getB2CHomeworkFileUrlAction,
  prepareB2CHomeworkUploadAction,
} from "../server/homework-actions";

export const HOMEWORK_DIALOG_CLASS =
  "max-h-[90dvh] overflow-y-auto [&>*]:min-w-0 [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2 [&>[data-slot=dialog-close]]:inline-flex [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center";

export function homeworkDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function homeworkFileError(
  file: File,
  kind: "assignment" | "submission",
) {
  const extensions: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = extensions[extension];
  if (
    !mime ||
    (kind === "assignment" && extension !== "pdf") ||
    (file.type && file.type !== mime)
  ) {
    return kind === "assignment"
      ? "Chọn tệp PDF cho đề bài."
      : "Chọn tệp PDF, JPG hoặc PNG cho bài nộp.";
  }
  if (file.size <= 0) return "Tệp đang trống. Vui lòng chọn tệp khác.";
  if (file.size > B2C_HOMEWORK_MAX_BYTES) return "Tệp vượt quá 20 MB.";
  return null;
}

type UploadTicket = NonNullable<
  Awaited<ReturnType<typeof prepareB2CHomeworkUploadAction>>["data"]
>;

export type HomeworkUploadAttempt = {
  requestId: string;
  ticket?: UploadTicket;
  uploaded: boolean;
};

export async function uploadHomeworkFile(
  file: File,
  context: {
    kind: "assignment" | "submission";
    classId: string | null;
    homeworkId: string | null;
  },
  attempt: HomeworkUploadAttempt,
) {
  const invalid = homeworkFileError(file, context.kind);
  if (invalid) throw new Error(invalid);
  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : file.name.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg");
  if (!attempt.ticket) {
    const result = await prepareB2CHomeworkUploadAction({
      kind: context.kind,
      class_id: context.classId,
      homework_id: context.homeworkId,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      request_id: attempt.requestId,
    });
    if (!result.data || result.error)
      throw new Error(
        result.error || "Không chuẩn bị được tệp. Vui lòng thử lại.",
      );
    attempt.ticket = result.data;
  }
  if (!attempt.uploaded) {
    const { error } = await createClient()
      .storage.from(attempt.ticket.bucket)
      .uploadToSignedUrl(attempt.ticket.path, attempt.ticket.token, file, {
        contentType: mime,
        upsert: false,
      });
    // A prior upload may have succeeded while its response was lost. The
    // finalize action still checks this exact owned object's size and contents.
    if (error && String(error.statusCode) !== "409")
      throw new Error("Không tải được tệp. Vui lòng kiểm tra mạng và thử lại.");
    attempt.uploaded = true;
  }
  return attempt.ticket.uploadId;
}

export function HomeworkFileButton({
  kind,
  id,
  label = "Mở tệp",
}: {
  kind: "assignment" | "submission";
  id: string;
  label?: string;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  async function openFile() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setFallbackUrl(null);
    // Open synchronously so Safari's popup blocker does not discard a valid
    // download after waiting for the permission-checked signed URL.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await getB2CHomeworkFileUrlAction(kind, id);
      if (!result.url || result.error)
        throw new Error(result.error || "Không mở được tệp. Vui lòng thử lại.");
      if (tab) tab.location.replace(result.url);
      else setFallbackUrl(result.url);
    } catch (reason) {
      tab?.close();
      setError(reason instanceof Error ? reason.message : "Không mở được tệp.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-1">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={busy}
        onClick={() => void openFile()}
      >
        <Download className="size-4" aria-hidden />
        {busy ? "Đang mở…" : label}
      </Button>
      {fallbackUrl && (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary block py-2 text-sm underline"
        >
          Tệp đã sẵn sàng — bấm để mở
        </a>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function HomeworkPagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 20 && page === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>
        {total} kết quả · Trang {page + 1}/{Math.max(1, Math.ceil(total / 20))}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          Trước
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={(page + 1) * 20 >= total}
          onClick={() => onChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
