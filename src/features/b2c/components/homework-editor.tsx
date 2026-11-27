"use client";

import { useId, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import type { B2CHomework } from "../domain/homework";
import {
  createB2CHomeworkAction,
  updateB2CHomeworkAction,
} from "../server/homework-actions";
import {
  HOMEWORK_DIALOG_CLASS,
  homeworkFileError,
  uploadHomeworkFile,
  type HomeworkUploadAttempt,
} from "./homework-shared";

export function HomeworkEditor({
  classId,
  homework,
  onClose,
  onSaved,
}: {
  classId: string;
  homework: B2CHomework | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const prefix = useId();
  const pending = useRef(false);
  const upload = useRef<HomeworkUploadAttempt | null>(null);
  const finalize = useRef<{ payload: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ActionState>({});

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    if (!homework && !file) {
      setState({ error: "Chọn tệp PDF cho đề bài." });
      return;
    }
    pending.current = true;
    setBusy(true);
    setState({});
    try {
      let result: ActionState;
      if (homework) {
        form.set("id", homework.id);
        form.set("expected_updated_at", homework.updated_at);
        result = await updateB2CHomeworkAction({}, form);
      } else {
        upload.current ??= { requestId: crypto.randomUUID(), uploaded: false };
        const uploadId = await uploadHomeworkFile(
          file!,
          { kind: "assignment", classId, homeworkId: null },
          upload.current,
        );
        const payload = JSON.stringify([
          uploadId,
          form.get("title"),
          form.get("description"),
          form.get("due_at"),
        ]);
        if (finalize.current?.payload !== payload)
          finalize.current = { payload, requestId: crypto.randomUUID() };
        form.set("upload_id", uploadId);
        form.set("request_id", finalize.current.requestId);
        result = await createB2CHomeworkAction({}, form);
      }
      if (result.success) onSaved();
      else
        setState(
          result.error || result.fieldErrors
            ? result
            : { error: "Chưa lưu được bài tập. Vui lòng thử lại." },
        );
    } catch (reason) {
      setState({
        error:
          reason instanceof Error
            ? reason.message
            : "Không lưu được bài tập. Vui lòng thử lại.",
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className={HOMEWORK_DIALOG_CLASS}>
        <DialogHeader className="pr-6">
          <DialogTitle>{homework ? "Sửa bài tập" : "Giao bài tập"}</DialogTitle>
          <DialogDescription>
            {homework
              ? "Cập nhật nội dung và hạn nộp. Đề bài và các bài đã nộp được giữ nguyên."
              : "Tải đề PDF và đặt hạn nộp. Học viên trong lớp có tài khoản sẽ xem và nộp bài trên hệ thống."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-title`}>Tên bài tập *</Label>
              <Input
                id={`${prefix}-title`}
                name="title"
                required
                maxLength={200}
                defaultValue={homework?.title ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-description`}>Hướng dẫn</Label>
              <Textarea
                id={`${prefix}-description`}
                name="description"
                rows={4}
                maxLength={4000}
                defaultValue={homework?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-due`}>Hạn nộp *</Label>
              <DateTimePicker
                id={`${prefix}-due`}
                name="due_at"
                placeholder="dd/mm/yyyy --:--"
                defaultValue={
                  homework
                    ? formatInTimeZone(
                        homework.due_at,
                        "Asia/Ho_Chi_Minh",
                        "yyyy-MM-dd'T'HH:mm",
                      )
                    : ""
                }
              />
            </div>
            {homework ? (
              <p className="text-muted-foreground text-sm break-words">
                Đề PDF: {homework.file_name}
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-file`}>Đề bài PDF *</Label>
                <Input
                  id={`${prefix}-file`}
                  type="file"
                  accept=".pdf,application/pdf"
                  aria-describedby={`${prefix}-file-help`}
                  onChange={(event) => {
                    const chosen = event.target.files?.[0] ?? null;
                    upload.current = null;
                    finalize.current = null;
                    const error = chosen
                      ? homeworkFileError(chosen, "assignment")
                      : null;
                    setFile(error ? null : chosen);
                    setState(error ? { error } : {});
                  }}
                />
                <p
                  id={`${prefix}-file-help`}
                  className="text-muted-foreground text-sm"
                >
                  Một tệp PDF, tối đa 20 MB.
                </p>
                {file && (
                  <p className="text-sm break-words">Đã chọn: {file.name}</p>
                )}
              </div>
            )}
          </fieldset>
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          {state.fieldErrors && (
            <p role="alert" className="text-destructive text-sm">
              {Object.values(state.fieldErrors).join(" ")}
            </p>
          )}
          {busy && (
            <p role="status" className="text-muted-foreground text-sm">
              {homework ? "Đang lưu thay đổi…" : "Đang tải tệp và lưu bài tập…"}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={busy || (!homework && !file)}
            >
              {busy ? "Đang lưu…" : homework ? "Lưu thay đổi" : "Giao bài tập"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
