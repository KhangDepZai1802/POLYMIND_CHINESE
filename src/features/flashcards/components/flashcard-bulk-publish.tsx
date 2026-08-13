"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  Eye,
  EyeOff,
  Loader2,
  SkipForward,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkSetFlashcardSectionStatusAction,
  type BulkPublishOutcome,
} from "@/features/flashcards/server/actions";

type Target = "published" | "draft";

/**
 * Hai nút "Công bố hàng loạt" / "Bỏ công bố hàng loạt" (`FLASHCARD-BULKPUB-1`).
 *
 * ## Vì sao icon là con mắt
 *
 * Công bố nghĩa là học viên NHÌN THẤY buổi đó. `Eye` / `EyeOff` nói đúng chuyện
 * ấy và tự thành một cặp đối nhau — hai nút đứng cạnh nhau phân biệt được bằng
 * hình, không phải đọc hết chữ mới biết cái nào là cái nào.
 *
 * ## Vì sao con số nằm ngay trên nút
 *
 * `Công bố hàng loạt · 28` nói trước sẽ đụng vào bao nhiêu buổi. Không còn buổi
 * nào để đụng thì nút **mờ đi và nói lý do** thay vì trở thành một nút bấm vào
 * chẳng xảy ra gì — trạng thái vô hình là thứ người dùng không bao giờ đoán ra.
 */
export function FlashcardBulkPublishActions({
  deckId,
  draftCount,
  publishedCount,
  onJumpToSession,
  layout = "row",
}: {
  deckId: string;
  draftCount: number;
  publishedCount: number;
  /** Nhảy tới buổi hỏng để sửa — lối thoát của trạng thái lỗi. */
  onJumpToSession?: (sessionNumber: number) => void;
  /** `row` cho hàng nút cấp bộ; `stack` cho bảng trượt ở màn hẹp. */
  layout?: "row" | "stack";
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const [result, setResult] = useState<BulkPublishOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setTarget(null);
    setResult(null);
    setError(null);
  }

  function run(next: Target) {
    const data = new FormData();
    data.set("deck_id", deckId);
    data.set("target", next);

    startTransition(async () => {
      const outcome = await bulkSetFlashcardSectionStatusAction(data);
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      setResult(outcome.outcomes ?? []);
      router.refresh();
    });
  }

  const buttonClass = layout === "stack" ? "w-full justify-start" : undefined;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={buttonClass}
        disabled={draftCount === 0}
        title={
          draftCount === 0
            ? "Mọi buổi trong bộ đã được công bố"
            : `Công bố ${draftCount} buổi đang ở nháp`
        }
        onClick={() => setTarget("published")}
      >
        <Eye className="size-4" aria-hidden />
        Công bố hàng loạt
        <span className="text-muted-foreground ml-1 font-mono text-xs tabular-nums">
          {draftCount}
        </span>
      </Button>

      <Button
        type="button"
        variant="outline"
        className={buttonClass}
        disabled={publishedCount === 0}
        title={
          publishedCount === 0
            ? "Chưa có buổi nào đang công bố"
            : `Đưa ${publishedCount} buổi về nháp`
        }
        onClick={() => setTarget("draft")}
      >
        <EyeOff className="size-4" aria-hidden />
        Bỏ công bố hàng loạt
        <span className="text-muted-foreground ml-1 font-mono text-xs tabular-nums">
          {publishedCount}
        </span>
      </Button>

      <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          {result ? (
            <BulkResult
              target={target ?? "published"}
              outcomes={result}
              onJumpToSession={(session) => {
                close();
                onJumpToSession?.(session);
              }}
              onClose={close}
            />
          ) : (
            <BulkConfirm
              target={target ?? "published"}
              draftCount={draftCount}
              publishedCount={publishedCount}
              pending={pending}
              error={error}
              onConfirm={() => target && run(target)}
              onCancel={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkConfirm({
  target,
  draftCount,
  publishedCount,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  target: Target;
  draftCount: number;
  publishedCount: number;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const publishing = target === "published";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {publishing
            ? "Công bố hàng loạt?"
            : `Đưa ${publishedCount} buổi về nháp?`}
        </DialogTitle>
        <DialogDescription>
          {publishing
            ? `${draftCount} buổi đang ở nháp sẽ được công bố. ${publishedCount} buổi đã công bố giữ nguyên.`
            : "Thao tác này đảo ngược được — công bố lại là mọi thứ trở về như cũ."}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {publishing ? (
        <>
          <Alert>
            <TriangleAlert className="size-4" aria-hidden />
            <AlertDescription>
              Buổi nào chưa đủ trang mở đầu hoặc trang từ vựng sẽ được{" "}
              <strong>bỏ qua</strong> và liệt kê lại ngay sau khi chạy.
            </AlertDescription>
          </Alert>
          <p className="text-text-secondary text-sm">
            Học viên trong khoá thấy nội dung ngay khi công bố xong.
          </p>
        </>
      ) : (
        /*
          Cảnh báo VÀNG chứ không đỏ, và nút xác nhận KHÔNG dùng `destructive`:
          repo dành màu đỏ cho "Vùng nguy hiểm" — thao tác mất dữ liệu. Bỏ công
          bố là đảo ngược được, nên phải nói rõ cái gì mất (quyền xem) và cái gì
          KHÔNG mất (thẻ, tiến độ ôn tập).
        */
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertDescription>
            <strong>
              Học viên mất quyền xem cả bộ thẻ này ngay lập tức
            </strong>
            , cho tới khi bạn công bố lại. Thẻ đã soạn, thẻ học viên đánh dấu khó
            và tiến độ ôn tập <strong>không bị xoá</strong>.
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {publishing ? "Huỷ" : "Giữ nguyên"}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : publishing ? (
            <Eye className="size-4" aria-hidden />
          ) : (
            <EyeOff className="size-4" aria-hidden />
          )}
          {publishing
            ? `Công bố ${draftCount} buổi`
            : `Đưa ${publishedCount} buổi về nháp`}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Bảng kết quả.
 *
 * 🔴 Mỗi buổi hỏng kèm nút nhảy tới đúng chỗ sửa. Trạng thái lỗi mà không có
 * lối ra thì người dùng chỉ còn nút Back của trình duyệt — đúng bài học
 * `UX-MOBILE-3` mà WORKLOG đã ghi.
 */
function BulkResult({
  target,
  outcomes,
  onJumpToSession,
  onClose,
}: {
  target: Target;
  outcomes: BulkPublishOutcome[];
  onJumpToSession: (sessionNumber: number) => void;
  onClose: () => void;
}) {
  const changed = outcomes.filter((row) => row.outcome === "changed");
  const skipped = outcomes.filter((row) => row.outcome === "skipped");
  const failed = outcomes.filter((row) => row.outcome === "failed");

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {target === "published" ? "Kết quả công bố" : "Kết quả bỏ công bố"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Tổng kết từng buổi sau khi chạy thao tác hàng loạt.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-2 text-sm">
        <Tally
          icon={CircleCheck}
          tone="text-success"
          count={changed.length}
          label={
            target === "published" ? "buổi đã công bố" : "buổi đã đưa về nháp"
          }
        />
        {skipped.length > 0 && (
          <Tally
            icon={SkipForward}
            tone="text-muted-foreground"
            count={skipped.length}
            label={
              target === "published"
                ? "buổi đã công bố từ trước"
                : "buổi vốn đã ở nháp"
            }
          />
        )}
        {failed.length > 0 && (
          <Tally
            icon={TriangleAlert}
            tone="text-warning"
            count={failed.length}
            label="buổi chưa công bố được"
          />
        )}
      </dl>

      {failed.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <ul className="divide-y">
            {failed.map((row) => (
              <li
                key={row.sessionNumber}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Buổi {row.sessionNumber}</p>
                  <p className="text-text-secondary text-xs">
                    {row.reason ?? "Chưa đủ điều kiện công bố"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onJumpToSession(row.sessionNumber)}
                >
                  Mở buổi
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Xong
        </Button>
      </DialogFooter>
    </>
  );
}

function Tally({
  icon: Icon,
  tone,
  count,
  label,
}: {
  icon: typeof CircleCheck;
  tone: string;
  count: number;
  label: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${tone}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-6 text-right font-mono font-bold tabular-nums">
        {count}
      </span>
      <span>{label}</span>
    </div>
  );
}
