"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, Loader2, X } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  matchFlashcardMediaFiles,
  MAX_FLASHCARD_BULK_UPLOAD_FILES,
  plannedUploads,
  summarizeBulkMedia,
  type BulkMediaTarget,
  type SlotPlan,
} from "@/features/flashcards/domain/bulk-media";
import { FLASHCARD_MEDIA_BUCKET } from "@/features/flashcards/domain/media";
import {
  attachFlashcardSectionMediaAction,
  createFlashcardBulkUploadTicketsAction,
  discardFlashcardUploadsAction,
} from "@/features/flashcards/server/actions";
import type { FlashcardSectionView } from "@/features/flashcards/server/queries";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = "image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,.mp3,.m4a";

/** Bao nhiêu file tải song song. Đủ nhanh mà không mở 40 kết nối một lúc. */
const UPLOAD_CONCURRENCY = 4;

type Phase = "select" | "uploading" | "done";

type RunResult = {
  message: string;
  failedFiles: string[];
};

function SlotCell({ plan }: { plan: SlotPlan }) {
  if (plan.state === "empty") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (plan.state === "keep") {
    return <span className="text-muted-foreground">giữ nguyên</span>;
  }
  return <span className="break-all">{plan.fileName}</span>;
}

/**
 * Trạng thái của một hàng, bằng CHỮ.
 *
 * `color-not-only`: màu chỉ phụ trợ. Và "Bỏ qua"/"Giữ nguyên" cố ý **không** tô
 * đỏ — chúng là kết quả bình thường, tô như lỗi sẽ đẩy người soạn đi tìm chỗ
 * hỏng không tồn tại (đúng cách tab "Danh sách chữ" đang xử trùng thẻ).
 */
function rowStatus(front: SlotPlan, audio: SlotPlan) {
  const states = [front.state, audio.state];
  if (states.includes("replace")) {
    return { label: "Sẽ thay", tone: "warning" as const };
  }
  if (states.includes("attach")) {
    return { label: "Sẽ thêm", tone: "success" as const };
  }
  if (states.includes("skip")) {
    return { label: "Bỏ qua", tone: "neutral" as const };
  }
  return { label: "Giữ nguyên", tone: "neutral" as const };
}

export function FlashcardBulkMediaTab({
  deckId,
  section,
  onDone,
}: {
  deckId: string;
  section: FlashcardSectionView;
  onDone: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const targets = useMemo<BulkMediaTarget[]>(
    () =>
      section.pages.map((page, index) => ({
        pageId: page.id,
        // Số ĐANG HIỆN trên màn hình (ô xám bên trái mỗi hàng), tính cả trang mở
        // đầu — xem `matchByNumber` trong `domain/bulk-media.ts`.
        displayNumber: index + 1,
        kind: page.kind,
        hanzi: page.hanzi,
        pinyinSyllables: page.pinyin_syllables,
        hasFront: Boolean(page.front_image_path),
        hasAudio: Boolean(page.audio_path),
      })),
    [section.pages],
  );

  const plan = useMemo(
    () =>
      matchFlashcardMediaFiles(
        files.map((file) => ({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        })),
        targets,
        { allowOverwrite, overrides },
      ),
    [files, targets, allowOverwrite, overrides],
  );

  const summary = useMemo(() => summarizeBulkMedia(plan), [plan]);
  const uploads = useMemo(() => plannedUploads(plan), [plan]);
  const vocabularyTargets = useMemo(
    () => targets.filter((item) => item.kind === "vocabulary"),
    [targets],
  );

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    setError(null);
    setFiles((current) => {
      const merged = [...current, ...Array.from(incoming)];
      if (merged.length > MAX_FLASHCARD_BULK_UPLOAD_FILES) {
        setError(
          `Mỗi lượt tối đa ${MAX_FLASHCARD_BULK_UPLOAD_FILES} file. Đã giữ lại ${MAX_FLASHCARD_BULK_UPLOAD_FILES} file đầu, làm thêm một lượt nữa cho phần còn lại.`,
        );
        return merged.slice(0, MAX_FLASHCARD_BULK_UPLOAD_FILES);
      }
      return merged;
    });
  }

  function dropFile(fileName: string) {
    setFiles((current) => current.filter((file) => file.name !== fileName));
    setOverrides((current) => {
      const next = new Map(current);
      next.delete(fileName);
      return next;
    });
  }

  function assign(fileName: string, pageId: string) {
    setOverrides((current) => {
      const next = new Map(current);
      if (pageId) next.set(fileName, pageId);
      else next.delete(fileName);
      return next;
    });
  }

  function resetAll() {
    setFiles([]);
    setOverrides(new Map());
    setAllowOverwrite(false);
    setPhase("select");
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function run() {
    if (uploads.length === 0) return;
    setError(null);
    setPhase("uploading");
    setProgress({ done: 0, total: uploads.length });

    const fileByName = new Map(files.map((file) => [file.name, file]));

    const ticketResult = await createFlashcardBulkUploadTicketsAction({
      sectionId: section.id,
      items: uploads.map((item) => {
        const file = fileByName.get(item.fileName)!;
        return {
          pageId: item.pageId,
          slot: item.slot,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        };
      }),
    });
    if ("error" in ticketResult) {
      setError(ticketResult.error);
      setPhase("select");
      return;
    }

    const supabase = createClient();
    const uploadByKey = new Map(
      uploads.map((item) => [`${item.pageId}:${item.slot}`, item.fileName]),
    );
    const uploaded: Array<{ pageId: string; slot: string; path: string }> = [];
    const failedFiles: string[] = [];
    let done = 0;

    // Tải theo lô nhỏ. Một file hỏng KHÔNG kéo cả lượt xuống — thẻ nào tải xong
    // thì ghi thẻ đó (nguyên tử theo TỪNG THẺ). Đường soạn một thẻ vứt sạch mọi
    // file khi gặp lỗi, đúng cho 1 thẻ nhưng sai cho 38: mất mạng ở file 37 mà
    // bỏ 36 thẻ đã xong thì đúng bằng cái mệt tính năng này sinh ra để xoá.
    const tickets = ticketResult.tickets;
    for (let start = 0; start < tickets.length; start += UPLOAD_CONCURRENCY) {
      const batch = tickets.slice(start, start + UPLOAD_CONCURRENCY);
      await Promise.all(
        batch.map(async (ticket) => {
          const fileName = uploadByKey.get(`${ticket.pageId}:${ticket.slot}`);
          const file = fileName ? fileByName.get(fileName) : undefined;
          if (!file) return;
          const { error: uploadError } = await supabase.storage
            .from(FLASHCARD_MEDIA_BUCKET)
            .uploadToSignedUrl(ticket.path, ticket.token, file, {
              contentType: ticket.contentType,
            });
          if (uploadError) failedFiles.push(file.name);
          else {
            uploaded.push({
              pageId: ticket.pageId,
              slot: ticket.slot,
              path: ticket.path,
            });
          }
          done += 1;
          setProgress({ done, total: tickets.length });
        }),
      );
    }

    if (uploaded.length === 0) {
      setError("Không tải được file nào. Kiểm tra kết nối rồi thử lại.");
      setPhase("select");
      return;
    }

    const byPage = new Map<
      string,
      { pageId: string; frontImagePath?: string; audioPath?: string }
    >();
    for (const item of uploaded) {
      const entry = byPage.get(item.pageId) ?? { pageId: item.pageId };
      if (item.slot === "front") entry.frontImagePath = item.path;
      else entry.audioPath = item.path;
      byPage.set(item.pageId, entry);
    }

    const attached = await attachFlashcardSectionMediaAction({
      sectionId: section.id,
      allowOverwrite,
      assignments: [...byPage.values()],
    });

    if (attached.error) {
      // Ghi thất bại thì file vừa tải thành rác trong bucket riêng. Dọn theo
      // từng trang vì đó là đơn vị mà `discardFlashcardUploadsAction` nhận.
      await Promise.all(
        [...byPage.values()].map((entry) =>
          discardFlashcardUploadsAction({
            deckId,
            sectionId: section.id,
            pageId: entry.pageId,
            paths: [entry.frontImagePath, entry.audioPath].filter(Boolean),
          }),
        ),
      );
      setError(attached.error);
      setPhase("select");
      return;
    }

    setResult({ message: attached.success ?? "Đã gắn media.", failedFiles });
    setPhase("done");
    router.refresh();
  }

  // ===================================================================
  // Màn tiến độ
  // ===================================================================
  if (phase === "uploading") {
    return (
      <div className="space-y-3 py-6">
        <p aria-live="polite" className="text-sm font-medium">
          Đang tải file {progress.done}/{progress.total}…
        </p>
        <Progress
          value={progress.done}
          max={progress.total}
          label={`Đã tải ${progress.done} trên ${progress.total} file`}
        />
        <p className="text-muted-foreground text-sm">
          Đừng đóng cửa sổ này cho tới khi chạy xong.
        </p>
      </div>
    );
  }

  // ===================================================================
  // Màn kết quả
  // ===================================================================
  if (phase === "done" && result) {
    return (
      <div className="space-y-4 py-4">
        <Alert>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
        {result.failedFiles.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription role="alert">
              {result.failedFiles.length} file không tải được:{" "}
              {result.failedFiles.join(", ")}. Chọn lại đúng những file đó rồi
              chạy thêm một lượt.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetAll}>
            Gắn tiếp lượt nữa
          </Button>
          <Button
            type="button"
            onClick={() => {
              resetAll();
              onDone();
            }}
          >
            Xong
          </Button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // Màn chọn file
  // ===================================================================
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Gắn file vào <strong>{vocabularyTargets.length} thẻ đã có</strong> trong
        buổi. Đường này không tạo thẻ mới.
      </p>

      {/*
        Kéo–thả chỉ là BỔ TRỢ. `<input type="file">` thật luôn có mặt và `<label>`
        bọc ngoài nên bấm/Tab/Enter đều mở được hộp chọn file — luật
        `gesture-alternative`: không bao giờ để thao tác chỉ làm được bằng chuột.
      */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`hover:border-ring focus-within:border-ring focus-within:ring-ring/50 block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-within:ring-[3px] ${
          dragging ? "border-ring bg-muted" : "border-input"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <FolderUp className="mx-auto size-6" aria-hidden />
        <span className="mt-2 block font-medium">
          Kéo thả file vào đây, hoặc bấm để chọn file
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          JPG · PNG · WEBP → ảnh mặt trước (mỗi ảnh ≤ 8 MB)
          <br />
          MP3 · M4A → audio phát âm (mỗi file ≤ 20 MB)
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          Đặt tên file theo Hán tự (<code>胡萝卜.mp3</code>), pinyin không dấu (
          <code>huluobo.mp3</code>) hoặc số thứ tự đang hiện (<code>03.mp3</code>
          ).
        </span>
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{error}</AlertDescription>
        </Alert>
      )}

      {files.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {files.length} file · gắn được {summary.attachCount +
                summary.replaceCount}{" "}
              · chưa khớp {summary.unmatchedCount}
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="flashcard-bulk-overwrite"
                checked={allowOverwrite}
                onCheckedChange={(next) => setAllowOverwrite(next === true)}
              />
              <Label
                htmlFor="flashcard-bulk-overwrite"
                className="cursor-pointer text-sm font-normal"
              >
                Ghi đè media thẻ đã có{" "}
                <span className="text-muted-foreground">
                  (xoá hẳn file cũ, không hoàn tác được)
                </span>
              </Label>
            </div>
          </div>

          <DataTable
            caption="Đối chiếu từng thẻ với file sẽ gắn, trước khi chạy"
            minWidthClass="min-w-[56rem]"
          >
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Thẻ</th>
                <th scope="col">Ảnh mặt trước</th>
                <th scope="col">Audio</th>
                <th scope="col">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const status = rowStatus(row.front, row.audio);
                return (
                  <tr key={row.target.pageId}>
                    <td className="tabular-nums">
                      {row.target.displayNumber}
                    </td>
                    <td>
                      <span className="font-medium">{row.target.hanzi}</span>{" "}
                      <span className="text-muted-foreground">
                        {row.target.pinyinSyllables}
                      </span>
                    </td>
                    <td>
                      <SlotCell plan={row.front} />
                    </td>
                    <td>
                      <SlotCell plan={row.audio} />
                    </td>
                    <td>
                      <StatusBadge label={status.label} tone={status.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          {plan.unmatched.length > 0 && (
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="text-sm font-semibold">
                {plan.unmatched.length} file chưa khớp thẻ nào
              </h3>
              <ul className="space-y-2">
                {plan.unmatched.map((item) => (
                  <li
                    key={item.fileName}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.fileName}</p>
                      <p className="text-muted-foreground text-sm">
                        {item.message}
                      </p>
                    </div>
                    <NativeSelect
                      id={`assign-${item.fileName}`}
                      aria-label={`Gán "${item.fileName}" cho thẻ`}
                      value={overrides.get(item.fileName) ?? ""}
                      onChange={(event) =>
                        assign(item.fileName, event.target.value)
                      }
                    >
                      <option value="">Gán cho thẻ…</option>
                      {vocabularyTargets.map((target) => (
                        <option key={target.pageId} value={target.pageId}>
                          {target.displayNumber}. {target.hanzi}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Bỏ file ${item.fileName} ra khỏi lượt này`}
                      onClick={() => dropFile(item.fileName)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.replaceCount > 0 && (
            <Alert variant="destructive">
              <AlertDescription role="alert">
                {summary.replaceCount} file cũ sẽ bị <strong>xoá hẳn</strong> và
                không lấy lại được. Tắt ô &ldquo;Ghi đè&rdquo; nếu bạn chỉ muốn
                gắn cho thẻ đang trống.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetAll}>
              Bỏ hết file
            </Button>
            <Button
              type="button"
              disabled={uploads.length === 0}
              onClick={() => {
                if (
                  summary.replaceCount > 0 &&
                  !window.confirm(
                    `Sẽ xoá hẳn ${summary.replaceCount} file cũ và không lấy lại được. Tiếp tục?`,
                  )
                ) {
                  return;
                }
                void run();
              }}
            >
              {phase !== "select" && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Gắn cho {summary.pageCount} thẻ
              {summary.replaceCount > 0 && ` · thay ${summary.replaceCount} file`}
            </Button>
          </div>
        </>
      )}

      {files.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Chưa chọn file nào. Tối đa {MAX_FLASHCARD_BULK_UPLOAD_FILES} file mỗi
          lượt.
        </p>
      )}
    </div>
  );
}
