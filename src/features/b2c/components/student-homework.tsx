"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { B2CHomework, B2CHomeworkPage } from "../domain/homework";
import {
  readB2CHomeworkAction,
  submitB2CHomeworkAction,
} from "../server/homework-actions";
import { HomeworkSubmissionHistory } from "./homework-submission-history";
import {
  HomeworkFileButton,
  HomeworkPagination,
  homeworkDate,
  homeworkFileError,
  uploadHomeworkFile,
  type HomeworkUploadAttempt,
} from "./homework-shared";

export function StudentHomework() {
  const [data, setData] = useState<B2CHomeworkPage | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    readB2CHomeworkAction(null, page)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
        setBusy(false);
      })
      .catch((reason) => {
        if (!active) return;
        setData(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được bài tập. Vui lòng thử lại.",
        );
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  function refresh() {
    setBusy(true);
    setRevision((value) => value + 1);
  }
  return (
    <section aria-label="Bài tập lớp trung tâm" className="min-w-0 space-y-4">
      {message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {message}
        </p>
      )}
      {busy ? (
        <p role="status" className="text-muted-foreground py-8 text-center">
          Đang tải bài tập…
        </p>
      ) : error ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive">
            {error}
          </p>
          <Button variant="outline" className="min-h-11" onClick={refresh}>
            Thử lại
          </Button>
        </div>
      ) : (
        data && (
          <>
            {!data.linked_student ? (
              <HomeworkEmpty
                title="Tài khoản chưa được liên kết với hồ sơ học viên lớp trung tâm."
                description="Liên hệ trung tâm để kiểm tra tài khoản và lớp của bạn."
              />
            ) : !data.classes.length && !data.rows.length ? (
              <HomeworkEmpty
                title="Bạn chưa có lớp trung tâm đang theo học."
                description="Khi trung tâm ghi danh bạn vào lớp, các bài tập được giao sẽ xuất hiện tại đây."
              />
            ) : !data.rows.length ? (
              <HomeworkEmpty
                title="Chưa có bài tập được giao."
                description="Giáo viên sẽ tải đề bài và thông báo hạn nộp tại đây."
              />
            ) : (
              <>
                <div className="min-w-0 space-y-6">
                  {data.rows.map((homework) => (
                    <StudentHomeworkCard
                      key={`${homework.id}-${homework.latest_submission?.id ?? "none"}`}
                      homework={homework}
                      serverNow={data.server_now}
                      onSubmitted={() => {
                        setMessage(`Đã nộp bài “${homework.title}”.`);
                        refresh();
                      }}
                    />
                  ))}
                </div>
                <HomeworkPagination
                  page={page}
                  total={data.total}
                  onChange={(next) => {
                    setBusy(true);
                    setPage(next);
                  }}
                />
              </>
            )}
          </>
        )
      )}
    </section>
  );
}

function HomeworkEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <BookOpen
        className="text-muted-foreground mx-auto mb-3 size-7"
        aria-hidden
      />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </div>
  );
}

function StudentHomeworkCard({
  homework,
  serverNow,
  onSubmitted,
}: {
  homework: B2CHomework;
  serverNow: string;
  onSubmitted: () => void;
}) {
  const inputId = useId();
  const pending = useRef(false);
  const upload = useRef<HomeworkUploadAttempt | null>(null);
  const requestId = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previous = homework.latest_submission;
  const [history, setHistory] = useState(false);
  const overdue = Date.parse(homework.due_at) <= Date.parse(serverNow);
  const status = previous ? "Đã nộp" : overdue ? "Quá hạn" : "Cần nộp";
  const statusClass = previous
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    : overdue
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
      : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !file || !homework.can_submit) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      upload.current ??= { requestId: crypto.randomUUID(), uploaded: false };
      requestId.current ??= crypto.randomUUID();
      const uploadId = await uploadHomeworkFile(
        file,
        {
          kind: "submission",
          classId: homework.class_id,
          homeworkId: homework.id,
        },
        upload.current,
      );
      const form = new FormData();
      form.set("homework_id", homework.id);
      form.set("upload_id", uploadId);
      form.set("request_id", requestId.current);
      const result = await submitB2CHomeworkAction({}, form);
      if (result.success) onSubmitted();
      else
        setError(
          result.error ||
            Object.values(result.fieldErrors ?? {}).join(" ") ||
            "Chưa nộp được bài. Vui lòng thử lại.",
        );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không nộp được bài. Vui lòng thử lại.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="bg-card min-w-0 overflow-hidden rounded-2xl border shadow-sm">
      <div
        className={`h-1.5 w-full ${previous ? "bg-emerald-500" : overdue ? "bg-rose-500" : "bg-primary"}`}
        aria-hidden
      />
      <div className="grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="min-w-0">
          <header className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12">
              <FileText className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-sm break-words">
                {homework.class_name}
              </p>
              <h2 className="mt-1 text-xl font-semibold break-words sm:text-2xl">
                {homework.title}
              </h2>
              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-4" aria-hidden />
                  Hạn nộp
                </span>
                <time className="text-foreground" dateTime={homework.due_at}>
                  {homeworkDate(homework.due_at)}
                </time>
              </div>
            </div>
          </header>

          <div className="mt-6 border-t pt-5">
            {homework.description ? (
              <p className="max-w-3xl text-sm leading-7 break-words whitespace-pre-wrap sm:text-base">
                {homework.description}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Giáo viên chưa thêm hướng dẫn cho bài tập này.
              </p>
            )}
          </div>

          <div className="mt-6 max-w-xl rounded-xl border bg-background p-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                <FileText className="text-muted-foreground size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{homework.file_name}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">Đề bài PDF</p>
              </div>
            </div>
            <div className="mt-3">
              <HomeworkFileButton
                kind="assignment"
                id={homework.id}
                label="Mở đề PDF"
              />
            </div>
          </div>
        </div>

        <aside
          aria-label="Bài tập của bạn"
          className="bg-muted/45 min-w-0 self-start rounded-2xl border p-4 sm:p-5 lg:sticky lg:top-6"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">Bài tập của bạn</h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${statusClass}`}
            >
              {previous ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : overdue ? (
                <CircleAlert className="size-3.5" aria-hidden />
              ) : (
                <Clock3 className="size-3.5" aria-hidden />
              )}
              {status}
            </span>
          </div>

          {previous && (
            <div className="mt-4 space-y-3 rounded-xl border bg-background p-3">
              <div>
                <p className="text-sm font-medium">
                  Bài nộp gần nhất · Lần {previous.revision}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  <time dateTime={previous.submitted_at}>
                    {homeworkDate(previous.submitted_at)}
                  </time>
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <p className="min-w-0 text-sm break-all">{previous.file_name}</p>
              </div>
              <HomeworkFileButton
                kind="submission"
                id={previous.id}
                label="Mở bài đã nộp"
              />
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => setHistory(true)}
              >
                Lịch sử nộp bài
              </Button>
            </div>
          )}

          {homework.can_submit ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => void submit(event)}
            >
              <div className="space-y-2 rounded-xl border border-dashed bg-background p-3">
                <Label htmlFor={inputId}>
                  {previous ? "Chọn bài nộp mới" : "Chọn bài nộp"}
                </Label>
                <Input
                  id={inputId}
                  type="file"
                  className="cursor-pointer bg-background"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  disabled={busy}
                  aria-describedby={`${inputId}-help`}
                  onChange={(event) => {
                    const chosen = event.target.files?.[0] ?? null;
                    upload.current = null;
                    requestId.current = null;
                    const invalid = chosen
                      ? homeworkFileError(chosen, "submission")
                      : null;
                    setFile(invalid ? null : chosen);
                    setError(invalid ?? "");
                  }}
                />
                <p id={`${inputId}-help`} className="text-muted-foreground text-xs leading-5">
                  PDF, JPG hoặc PNG · Tối đa 20 MB
                </p>
                {file && (
                  <p className="text-sm break-all">Đã chọn: {file.name}</p>
                )}
              </div>
              {previous && (
                <p className="text-muted-foreground text-sm leading-5">
                  Có thể nộp lại trước hạn. Bản cũ vẫn được lưu trong lịch sử.
                </p>
              )}
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={busy || !file}
              >
                <Upload className="size-4" aria-hidden />
                {busy ? "Đang nộp…" : previous ? "Nộp lại bài" : "Nộp bài"}
              </Button>
              {busy && (
                <p role="status" className="text-muted-foreground text-sm">
                  Đang tải tệp và ghi nhận bài nộp…
                </p>
              )}
            </form>
          ) : (
            <p className="text-muted-foreground mt-4 rounded-xl border bg-background p-3 text-sm leading-5">
              {overdue
                ? "Đã hết hạn nộp bài."
                : "Bài tập hiện không nhận thêm bài nộp."}
            </p>
          )}

          {error && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {error}
            </p>
          )}
        </aside>
      </div>
      {history && (
        <HomeworkSubmissionHistory
          homeworkId={homework.id}
          title={homework.title}
          onClose={() => setHistory(false)}
        />
      )}
    </article>
  );
}
