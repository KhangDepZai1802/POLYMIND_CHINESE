"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  B2CHomework,
  B2CHomeworkPage,
  B2CHomeworkSubmissionsPage,
} from "../domain/homework";
import {
  archiveB2CHomeworkAction,
  readB2CHomeworkAction,
  readB2CHomeworkSubmissionsAction,
} from "../server/homework-actions";
import { HomeworkEditor } from "./homework-editor";
import { HomeworkSubmissionHistory } from "./homework-submission-history";
import {
  HOMEWORK_DIALOG_CLASS,
  HomeworkFileButton,
  HomeworkPagination,
  homeworkDate,
} from "./homework-shared";

export function HomeworkPanel({
  classId,
  canManage,
}: {
  classId: string;
  canManage: boolean;
}) {
  const [data, setData] = useState<B2CHomeworkPage | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ homework: B2CHomework | null } | null>(
    null,
  );
  const [roster, setRoster] = useState<B2CHomework | null>(null);
  const [archive, setArchive] = useState<B2CHomework | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    readB2CHomeworkAction(classId, page)
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
  }, [classId, page, revision]);
  function refresh() {
    setBusy(true);
    setPage(0);
    setRevision((value) => value + 1);
  }
  return (
    <section aria-label="Bài tập của lớp" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Bài tập</h2>
        {canManage && (
          <Button
            className="min-h-11"
            onClick={() => setEditor({ homework: null })}
          >
            <Plus className="size-4" aria-hidden />
            Giao bài tập
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
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
            {!data.rows.length ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <BookOpen
                  className="text-muted-foreground mx-auto mb-3 size-6"
                  aria-hidden
                />
                <p className="font-medium">Lớp chưa có bài tập.</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {canManage
                    ? "Chọn Giao bài tập để tải đề PDF và đặt hạn nộp."
                    : "Bài tập đã giao sẽ xuất hiện tại đây."}
                </p>
              </div>
            ) : (
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                {data.rows.map((homework) => (
                  <article
                    key={homework.id}
                    className="bg-card min-w-0 space-y-4 rounded-xl border p-4 sm:p-5"
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold break-words">
                        {homework.title}
                      </h3>
                      <p className="text-sm">
                        Hạn nộp:{" "}
                        <time dateTime={homework.due_at}>
                          {homeworkDate(homework.due_at)}
                        </time>
                      </p>
                      {homework.description && (
                        <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
                          {homework.description}
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm break-words">
                        Đề PDF: {homework.file_name}
                      </p>
                      <p className="text-sm">
                        Đã nộp {homework.submission_count}/
                        {homework.student_count} học viên
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <HomeworkFileButton
                        kind="assignment"
                        id={homework.id}
                        label="Mở đề PDF"
                      />
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => setRoster(homework)}
                      >
                        Bài đã nộp
                      </Button>
                      {canManage && homework.can_manage && (
                        <>
                          <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => setEditor({ homework })}
                          >
                            Sửa bài tập
                          </Button>
                          <Button
                            variant="ghost"
                            className="min-h-11"
                            onClick={() => setArchive(homework)}
                          >
                            Ẩn bài tập
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <HomeworkPagination
              page={page}
              total={data.total}
              onChange={(next) => {
                setBusy(true);
                setPage(next);
              }}
            />
          </>
        )
      )}
      {editor && (
        <HomeworkEditor
          classId={classId}
          homework={editor.homework}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setMessage(
              editor.homework
                ? "Đã cập nhật bài tập."
                : "Đã giao bài tập cho lớp.",
            );
            refresh();
          }}
        />
      )}
      {roster && (
        <HomeworkSubmissionsDialog
          homework={roster}
          onClose={() => setRoster(null)}
        />
      )}
      {archive && (
        <ArchiveHomeworkDialog
          homework={archive}
          onClose={() => setArchive(null)}
          onSaved={() => {
            setArchive(null);
            setMessage("Đã ẩn bài tập.");
            refresh();
          }}
        />
      )}
    </section>
  );
}

function HomeworkSubmissionsDialog({
  homework,
  onClose,
}: {
  homework: B2CHomework;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<B2CHomeworkSubmissionsPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{
    enrollmentId: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    readB2CHomeworkSubmissionsAction(homework.id, page)
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
          reason instanceof Error ? reason.message : "Không tải được bài nộp.",
        );
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [homework.id, page, revision]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={`${HOMEWORK_DIALOG_CLASS} sm:max-w-2xl`}>
        <DialogHeader className="pr-6">
          <DialogTitle>Bài đã nộp</DialogTitle>
          <DialogDescription>
            {homework.title} · {homework.class_name}
          </DialogDescription>
        </DialogHeader>
        {busy ? (
          <p role="status">Đang tải bài nộp…</p>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-destructive">
              {error}
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setBusy(true);
                setRevision((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
          </div>
        ) : (
          data && (
            <>
              {!data.rows.length && (
                <p className="text-muted-foreground py-4">
                  Chưa có học viên trong danh sách giao bài.
                </p>
              )}
              <div className="space-y-3">
                {data.rows.map((row) => (
                  <article
                    key={row.enrollment_id}
                    className="min-w-0 space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium break-words">
                          {row.full_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {row.student_code}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${row.submission ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
                      >
                        {row.submission ? "Đã nộp" : "Chưa nộp"}
                      </span>
                    </div>
                    {!row.has_account && (
                      <p className="text-muted-foreground text-sm">
                        Chưa có tài khoản học viên. Quản trị viên cần cấp tài
                        khoản để học viên nộp bài.
                      </p>
                    )}
                    {row.submission && (
                      <>
                        <p className="text-sm">
                          Lần nộp {row.submission.revision} ·{" "}
                          <time dateTime={row.submission.submitted_at}>
                            {homeworkDate(row.submission.submitted_at)}
                          </time>
                        </p>
                        <p className="text-muted-foreground text-sm break-words">
                          {row.submission.file_name}
                        </p>
                        <HomeworkFileButton
                          kind="submission"
                          id={row.submission.id}
                          label="Mở bài nộp"
                        />
                        <Button
                          variant="outline"
                          className="min-h-11"
                          onClick={() =>
                            setHistory({
                              enrollmentId: row.enrollment_id,
                              name: row.full_name,
                            })
                          }
                        >
                          Lịch sử nộp bài
                        </Button>
                      </>
                    )}
                  </article>
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
          )
        )}
      </DialogContent>
      {history && (
        <HomeworkSubmissionHistory
          homeworkId={homework.id}
          enrollmentId={history.enrollmentId}
          title={`${history.name} · ${homework.title}`}
          onClose={() => setHistory(null)}
        />
      )}
    </Dialog>
  );
}

function ArchiveHomeworkDialog({
  homework,
  onClose,
  onSaved,
}: {
  homework: B2CHomework;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function archive() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("id", homework.id);
      form.set("expected_updated_at", homework.updated_at);
      const result = await archiveB2CHomeworkAction({}, form);
      if (result.success) onSaved();
      else setError(result.error || "Không ẩn được bài tập. Vui lòng thử lại.");
    } catch {
      setError("Không ẩn được bài tập. Vui lòng kiểm tra mạng và thử lại.");
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
          <DialogTitle>Ẩn bài tập?</DialogTitle>
          <DialogDescription>
            {homework.title} sẽ được ẩn khỏi danh sách. Lịch sử bài đã nộp vẫn
            được lưu.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={busy}
            onClick={() => void archive()}
          >
            {busy ? "Đang ẩn…" : "Xác nhận ẩn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
