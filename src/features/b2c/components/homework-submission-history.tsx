"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { B2CHomeworkSubmissionHistory } from "../domain/homework";
import { readB2CHomeworkSubmissionHistoryAction } from "../server/homework-actions";
import {
  HOMEWORK_DIALOG_CLASS,
  HomeworkFileButton,
  HomeworkPagination,
  homeworkDate,
} from "./homework-shared";

export function HomeworkSubmissionHistory({
  homeworkId,
  enrollmentId = null,
  title,
  onClose,
}: {
  homeworkId: string;
  enrollmentId?: string | null;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<B2CHomeworkSubmissionHistory | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    readB2CHomeworkSubmissionHistoryAction(homeworkId, enrollmentId, page)
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
            : "Không tải được lịch sử nộp bài.",
        );
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [homeworkId, enrollmentId, page, revision]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={`${HOMEWORK_DIALOG_CLASS} sm:max-w-xl`}>
        <DialogHeader className="pr-6">
          <DialogTitle>Lịch sử nộp bài</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {busy ? (
          <p role="status">Đang tải lịch sử nộp bài…</p>
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
                <p className="text-muted-foreground">
                  Chưa có lần nộp bài nào.
                </p>
              )}
              <div className="space-y-3">
                {data.rows.map((submission) => (
                  <article
                    key={submission.id}
                    className="min-w-0 space-y-2 rounded-lg border p-3"
                  >
                    <p className="font-medium">Lần nộp {submission.revision}</p>
                    <p className="text-sm">
                      <time dateTime={submission.submitted_at}>
                        {homeworkDate(submission.submitted_at)}
                      </time>
                    </p>
                    <p className="text-muted-foreground text-sm break-words">
                      {submission.file_name}
                    </p>
                    <HomeworkFileButton
                      kind="submission"
                      id={submission.id}
                      label="Mở bài nộp"
                    />
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
    </Dialog>
  );
}
