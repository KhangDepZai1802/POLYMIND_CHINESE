"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  describeVideoImportIssue,
  MAX_VIDEO_IMPORT_ROWS,
  parseVideoImportText,
  stripSessionPrefix,
  youtubeWatchUrl,
} from "@/features/videos/domain/youtube-url";
import { saveLessonVideosAction } from "@/features/videos/server/actions";

const PLACEHOLDER = [
  "1 | https://youtu.be/dQw4w9WgXcQ",
  "2 | https://www.youtube.com/watch?v=abc12345678",
  "3 | https://youtu.be/xyz98765432 | Tiêu đề tự đặt (không bắt buộc)",
].join("\n");

/**
 * Dán cả danh sách link YouTube cho một bộ video (`VIDEO-1d`).
 *
 * Dùng lại mô hình *dán chữ → xem trước từng dòng → mới bấm chạy* của
 * `flashcard-import-dialog.tsx`: admin đã học nó một lần rồi, dùng lại đỡ phải
 * học lần hai. 35 ô nhập là 35 cú bấm cộng 35 lần dán; dán một khối là một lần.
 */
export function VideoImportDialog({
  collectionId,
  maxSessionNumber,
  existingSessionNumbers,
}: {
  collectionId: string;
  maxSessionNumber: number;
  existingSessionNumbers: readonly number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [pending, startTransition] = useTransition();

  const existing = useMemo(
    () => new Set(existingSessionNumbers),
    [existingSessionNumbers],
  );

  const parsed = useMemo(
    () => parseVideoImportText(text, { maxSessionNumber }),
    [text, maxSessionNumber],
  );

  /** Dòng dùng được, tách theo việc nó sẽ THÊM hay THAY. */
  const plan = useMemo(() => {
    const willReplace = parsed.valid.filter((row) =>
      existing.has(row.sessionNumber!),
    );
    const willAdd = parsed.valid.filter((row) => !existing.has(row.sessionNumber!));
    return {
      willAdd,
      willReplace,
      // Ghi đè tắt ⇒ hàng đã có bị bỏ qua, nên số thật sự lưu chỉ còn phần thêm.
      savedCount: allowOverwrite ? parsed.valid.length : willAdd.length,
      replacedCount: allowOverwrite ? willReplace.length : 0,
    };
  }, [parsed.valid, existing, allowOverwrite]);

  const brokenRows = parsed.rows.filter((row) => row.issue !== null);

  function handleSubmit() {
    startTransition(async () => {
      const result = await saveLessonVideosAction({
        collectionId,
        allowOverwrite,
        items: parsed.valid.map((row) => ({
          sessionNumber: row.sessionNumber!,
          youtubeVideoId: row.youtubeVideoId!,
          title: row.title,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Đã lưu.");
      setText("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Đang lưu thì không cho đóng (`sheet-dismiss-confirm`) — đóng giữa
        // chừng để lại một lô nửa vời mà admin không biết đã tới đâu.
        if (pending) return;
        if (!next && text.trim() !== "") {
          const confirmed = window.confirm(
            "Bỏ danh sách đang dán? Nội dung sẽ mất.",
          );
          if (!confirmed) return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="size-4" aria-hidden />
          Nhập hàng loạt
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập video hàng loạt</DialogTitle>
          <DialogDescription>
            Mỗi dòng một buổi. Dán trực tiếp link YouTube — nhận cả dạng{" "}
            <code>youtu.be/…</code>, <code>watch?v=…</code> và{" "}
            <code>/shorts/…</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-import-text">Danh sách link</Label>
            <Textarea
              id="video-import-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={PLACEHOLDER}
              rows={8}
              className="font-mono text-sm"
              disabled={pending}
            />
            <p className="text-muted-foreground text-xs">
              Dạng: <code>số buổi | link | tiêu đề</code>. Bỏ trống tiêu đề thì hệ
              thống tự lấy tên video từ YouTube. Tối đa {MAX_VIDEO_IMPORT_ROWS}{" "}
              dòng.
            </p>
          </div>

          {parsed.rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-0.5 font-medium tabular-nums">
                  {parsed.rows.length} dòng
                </span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_12%,white)] px-3 py-0.5 font-semibold tabular-nums text-[var(--success)]">
                  hợp lệ {parsed.valid.length}
                </span>
                {brokenRows.length > 0 ? (
                  <span className="border-student-amber-border bg-student-amber-surface text-student-amber-ink rounded-full border px-3 py-0.5 font-semibold tabular-nums">
                    lỗi {brokenRows.length}
                  </span>
                ) : null}

                <label className="ml-auto flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={allowOverwrite}
                    onCheckedChange={(value) => setAllowOverwrite(value === true)}
                    disabled={pending}
                  />
                  <span className="text-sm">Ghi đè buổi đã có link</span>
                </label>
              </div>

              {parsed.duplicateVideoIds.length > 0 ? (
                <Alert>
                  <AlertDescription>
                    Có {parsed.duplicateVideoIds.length} video được gán cho nhiều
                    buổi. Không chặn — nhưng kiểm lại xem có dán nhầm không.
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Bảng cuộn ngang TRONG khung của nó; thân dialog không bao giờ
                  cuộn ngang (`horizontal-scroll`). */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Xem trước danh sách video sẽ lưu
                  </caption>
                  <thead className="bg-surface-sunken">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Buổi
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Tiêu đề
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Video
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Tình trạng
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row) => {
                      const broken = row.issue !== null;
                      const replacing =
                        !broken && existing.has(row.sessionNumber!);
                      const skipped = replacing && !allowOverwrite;

                      return (
                        <tr key={row.lineNumber} className="border-t">
                          <td className="px-3 py-2 tabular-nums">
                            {row.sessionNumber ?? "—"}
                          </td>
                          <td className="max-w-[15rem] px-3 py-2">
                            <span className="block truncate">
                              {broken ? (
                                <span className="text-muted-foreground">
                                  Dòng {row.lineNumber}:{" "}
                                  {describeVideoImportIssue(row.issue!, {
                                    maxSessionNumber,
                                  })}
                                </span>
                              ) : (
                                (row.title
                                  ? stripSessionPrefix(row.title, row.sessionNumber!)
                                  : null) ?? (
                                  <span className="text-muted-foreground italic">
                                    lấy từ YouTube
                                  </span>
                                )
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.youtubeVideoId ? (
                              /* Nút "mở thử" — thay cho việc gọi YouTube kiểm
                                 video có tồn tại không. Rẻ hơn và đáng tin hơn:
                                 admin tự nhìn bằng mắt. */
                              <a
                                href={youtubeWatchUrl(row.youtubeVideoId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
                              >
                                {row.youtubeVideoId}
                                <ExternalLink className="size-3" aria-hidden />
                                <span className="sr-only">(mở thử ở tab mới)</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {/* Trạng thái đọc được BẰNG CHỮ; màu chỉ phụ trợ
                                (`color-not-only`). "Bỏ qua" KHÔNG tô đỏ — đó là
                                kết quả bình thường. */}
                            {broken ? (
                              <span className="text-student-amber-ink font-semibold">
                                Không đọc được
                              </span>
                            ) : skipped ? (
                              <span className="text-muted-foreground">Bỏ qua</span>
                            ) : replacing ? (
                              <span className="text-student-amber-ink font-semibold">
                                Sẽ thay
                              </span>
                            ) : (
                              <span className="font-semibold text-[var(--success)]">
                                Sẽ thêm
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || plan.savedCount === 0}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Đang lưu…
              </>
            ) : (
              /* Số buổi bị THAY in thẳng trên nút, không giấu trong tooltip
                 (`destructive-emphasis`): người bấm phải thấy hậu quả trước. */
              <>
                Lưu {plan.savedCount} buổi
                {plan.replacedCount > 0 ? ` · thay ${plan.replacedCount}` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
