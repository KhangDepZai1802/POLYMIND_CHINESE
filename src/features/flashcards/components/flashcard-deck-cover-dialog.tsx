"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Loader2, X } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { compressFlashcardImages } from "@/features/flashcards/client/compress-image";
import {
  matchFlashcardCoverFiles,
  MAX_FLASHCARD_COVER_UPLOAD_FILES,
  plannedCoverUploads,
  summarizeCoverPlan,
  type CoverPlan,
  type CoverTarget,
} from "@/features/flashcards/domain/deck-covers";
import {
  FLASHCARD_MEDIA_BUCKET,
  FLASHCARD_MEDIA_CACHE_CONTROL,
} from "@/features/flashcards/domain/media";
import {
  attachFlashcardDeckCoversAction,
  createFlashcardDeckCoverTicketsAction,
} from "@/features/flashcards/server/actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Bao nhiêu ảnh tải song song. Giữ đúng con số của đường gắn media cả buổi. */
const UPLOAD_CONCURRENCY = 6;

type Phase = "select" | "compressing" | "uploading" | "done";

type RunResult = {
  message: string;
  failedFiles: string[];
};

/**
 * NHẬP HÀNG LOẠT ẢNH TRANG MỞ ĐẦU CHO CẢ BỘ THẺ (`COVER-1`/`D-41`).
 *
 * 🔴 Vì sao là hộp thoại RIÊNG ở cấp bộ chứ không phải tab thứ ba của "Nhập hàng
 * loạt": hộp thoại kia thuộc về **một buổi** — tiêu đề nó là "Nhập hàng loạt —
 * Buổi N" và cả hai tab đều ghi vào đúng buổi đó. Nhét một việc chạm tới 35 buổi
 * vào trong nó là đặt hai phạm vi khác nhau sau cùng một nhãn, và người dùng chỉ
 * phát hiện ra sau khi đã bấm chạy. Nút mở nằm ở hàng nút **cấp bộ** (cạnh "Thêm
 * buổi"), đúng tầng mà nó tác động (`D-41` điểm 5).
 *
 * Luồng và cách chống mất dữ liệu chép nguyên tắc của `FlashcardBulkMediaTab`:
 * xem trước bằng bảng đối chiếu trước khi ghi · ô Ghi đè mặc định TẮT · một lượt
 * xin vé cho cả bộ (rate limit) · thất bại theo TỪNG BUỔI, không kéo cả lượt.
 */
export function FlashcardDeckCoverDialog({ deck }: { deck: FlashcardDeckView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const targets = useMemo<CoverTarget[]>(
    () =>
      deck.sections.map((section) => ({
        sectionId: section.id,
        sessionNumber: section.session_number,
        title: section.title,
        published: section.status === "published",
        hasCover: section.pages.some((page) => page.kind === "session_cover"),
      })),
    [deck.sections],
  );

  const plan = useMemo(
    () =>
      matchFlashcardCoverFiles(
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

  const summary = useMemo(() => summarizeCoverPlan(plan), [plan]);
  const uploads = useMemo(() => plannedCoverUploads(plan), [plan]);
  const draftTargets = useMemo(
    () => targets.filter((item) => !item.published),
    [targets],
  );

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    setError(null);
    setFiles((current) => {
      const merged = [...current, ...Array.from(incoming)];
      if (merged.length > MAX_FLASHCARD_COVER_UPLOAD_FILES) {
        setError(
          `Mỗi lượt tối đa ${MAX_FLASHCARD_COVER_UPLOAD_FILES} ảnh. Đã giữ lại ${MAX_FLASHCARD_COVER_UPLOAD_FILES} ảnh đầu, làm thêm một lượt nữa cho phần còn lại.`,
        );
        return merged.slice(0, MAX_FLASHCARD_COVER_UPLOAD_FILES);
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

  function assign(fileName: string, sectionId: string) {
    setOverrides((current) => {
      const next = new Map(current);
      if (sectionId) next.set(fileName, sectionId);
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

    /*
     * NÉN TRƯỚC KHI XIN VÉ (`PERF-IMG-1`), và chỉ nén đúng ảnh sẽ tải lên.
     * Khoá của `compressedByName` là tên GỐC, vì tên có thể đổi đuôi sau khi nén
     * (`.jpg` → `.webp`) còn `uploads[].fileName` là thứ bảng đối chiếu đã chốt.
     */
    const plannedFiles = files.filter((file) =>
      uploads.some((item) => item.fileName === file.name),
    );
    setPhase("compressing");
    setProgress({ done: 0, total: plannedFiles.length });
    const compressedByName = await compressFlashcardImages(
      plannedFiles,
      (done, total) => setProgress({ done, total }),
    );

    setPhase("uploading");
    setProgress({ done: 0, total: uploads.length });

    const fileByName = new Map(
      plannedFiles.map((file) => [
        file.name,
        compressedByName.get(file.name)?.file ?? file,
      ]),
    );

    const ticketResult = await createFlashcardDeckCoverTicketsAction({
      deckId: deck.id,
      items: uploads.map((item) => {
        const file = fileByName.get(item.fileName)!;
        return {
          sectionId: item.sectionId,
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
    const fileNameBySection = new Map(
      uploads.map((item) => [item.sectionId, item.fileName]),
    );
    const uploaded: Array<{
      sectionId: string;
      pageId: string;
      path: string;
    }> = [];
    const failedFiles: string[] = [];
    let done = 0;

    // Tải theo lô nhỏ. Một ảnh hỏng KHÔNG kéo cả lượt xuống — buổi nào tải xong
    // thì ghi buổi đó (nguyên tử theo TỪNG BUỔI), đúng nguyên tắc đã dùng cho
    // đường gắn media cả buổi.
    const tickets = ticketResult.tickets;
    for (let start = 0; start < tickets.length; start += UPLOAD_CONCURRENCY) {
      const batch = tickets.slice(start, start + UPLOAD_CONCURRENCY);
      await Promise.all(
        batch.map(async (ticket) => {
          const fileName = fileNameBySection.get(ticket.sectionId);
          const file = fileName ? fileByName.get(fileName) : undefined;
          if (!fileName || !file) return;
          // 🔴 `contentType` trong tuỳ chọn KHÔNG có tác dụng khi thân request là
          // Blob/File — xem `flashcard-bulk-media-tab.tsx`. `slice` đổi kiểu mà
          // không sao chép byte, nên thứ nằm trong bucket luôn khớp kiểu server
          // suy từ đuôi file.
          const body = file.slice(0, file.size, ticket.contentType);
          const { error: uploadError } = await supabase.storage
            .from(FLASHCARD_MEDIA_BUCKET)
            .uploadToSignedUrl(ticket.path, ticket.token, body, {
              contentType: ticket.contentType,
              cacheControl: FLASHCARD_MEDIA_CACHE_CONTROL,
            });
          // Tên GỐC, không phải tên sau khi nén: người soạn đi tìm file trong
          // thư mục của họ theo cái tên họ đặt.
          if (uploadError) failedFiles.push(fileName);
          else {
            uploaded.push({
              sectionId: ticket.sectionId,
              pageId: ticket.pageId,
              path: ticket.path,
            });
          }
          done += 1;
          setProgress({ done, total: tickets.length });
        }),
      );
    }

    if (uploaded.length === 0) {
      setError("Không tải được ảnh nào. Kiểm tra kết nối rồi thử lại.");
      setPhase("select");
      return;
    }

    const attached = await attachFlashcardDeckCoversAction({
      deckId: deck.id,
      allowOverwrite,
      assignments: uploaded.map((item) => ({
        sectionId: item.sectionId,
        pageId: item.pageId,
        frontImagePath: item.path,
      })),
    });

    if (attached.error) {
      // Ghi thất bại thì ảnh vừa tải thành rác. Server đã dọn phần nó loại; phần
      // còn lại chỉ server biết đường dẫn nào hợp lệ nên client không tự xoá.
      //
      // ⛔ TRỪ khi server báo `keepUploads`: lúc đó nó chưa soi được ảnh chứ
      // không phải ảnh hỏng, và đã dặn "bấm chạy lại".
      setError(
        failedFiles.length > 0
          ? `${attached.error} Ngoài ra ${failedFiles.length} ảnh không tải lên được: ${failedFiles.join(", ")}.`
          : attached.error,
      );
      setPhase("select");
      return;
    }

    // Đường dẫn do server loại → đổi ngược về tên file người soạn đã thả vào.
    const sectionByPath = new Map(
      uploaded.map((item) => [item.path, item.sectionId]),
    );
    const rejectedNames = (attached.outcome?.rejectedPaths ?? []).map((path) => {
      const sectionId = sectionByPath.get(path);
      return (sectionId && fileNameBySection.get(sectionId)) ?? path;
    });

    setResult({
      message: attached.success ?? "Đã gắn ảnh mở đầu.",
      failedFiles: [...failedFiles, ...rejectedNames],
    });
    setPhase("done");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      {/*
        `DS-051`: nút mở do CHÍNH component client này dựng, không nhận React
        element qua prop rồi đưa xuống `asChild`.
      */}
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Images className="size-4" aria-hidden />
          Ảnh mở đầu hàng loạt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ảnh trang mở đầu hàng loạt — {deck.title}</DialogTitle>
          <DialogDescription>
            Thả một ảnh cho mỗi buổi, đặt tên kèm số buổi. Mỗi ảnh dùng cho cả
            mặt trước và mặt sau của trang mở đầu buổi đó.
          </DialogDescription>
        </DialogHeader>

        <FlashcardDeckCoverBody
          deckSectionCount={deck.sections.length}
          draftTargets={draftTargets}
          phase={phase}
          progress={progress}
          result={result}
          error={error}
          files={files}
          plan={plan}
          summary={summary}
          uploadCount={uploads.length}
          allowOverwrite={allowOverwrite}
          overrides={overrides}
          dragging={dragging}
          inputRef={inputRef}
          onDragging={setDragging}
          onAddFiles={addFiles}
          onDropFile={dropFile}
          onAssign={assign}
          onToggleOverwrite={setAllowOverwrite}
          onReset={resetAll}
          onRun={() => void run()}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nhãn trạng thái của MỘT buổi, bằng CHỮ.
 *
 * `color-not-only`: màu chỉ phụ trợ. "Bỏ qua"/"Giữ nguyên" cố ý **không** tô đỏ —
 * chúng là kết quả bình thường, tô như lỗi sẽ đẩy người soạn đi tìm chỗ hỏng
 * không tồn tại (đúng cách hai đường nhập hàng loạt cũ đang xử trùng thẻ).
 */
function coverStatus(plan: CoverPlan) {
  switch (plan.state) {
    case "attach":
      return { label: "Sẽ thêm", tone: "success" as const };
    case "replace":
      return { label: "Sẽ thay", tone: "warning" as const };
    case "skip":
      return { label: "Bỏ qua", tone: "neutral" as const };
    case "published":
      return { label: "Đã công bố", tone: "info" as const };
    case "keep":
      return { label: "Giữ nguyên", tone: "neutral" as const };
    default:
      return { label: "Chưa có ảnh", tone: "neutral" as const };
  }
}

function CoverFileCell({ plan }: { plan: CoverPlan }) {
  if (plan.state === "empty") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (plan.state === "keep") {
    return <span className="text-muted-foreground">giữ nguyên</span>;
  }
  if (plan.state === "published") {
    return plan.fileName ? (
      <span className="break-all">{plan.fileName}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  return <span className="break-all">{plan.fileName}</span>;
}

function FlashcardDeckCoverBody({
  deckSectionCount,
  draftTargets,
  phase,
  progress,
  result,
  error,
  files,
  plan,
  summary,
  uploadCount,
  allowOverwrite,
  overrides,
  dragging,
  inputRef,
  onDragging,
  onAddFiles,
  onDropFile,
  onAssign,
  onToggleOverwrite,
  onReset,
  onRun,
  onClose,
}: {
  deckSectionCount: number;
  draftTargets: CoverTarget[];
  phase: Phase;
  progress: { done: number; total: number };
  result: RunResult | null;
  error: string | null;
  files: File[];
  plan: ReturnType<typeof matchFlashcardCoverFiles>;
  summary: ReturnType<typeof summarizeCoverPlan>;
  uploadCount: number;
  allowOverwrite: boolean;
  overrides: ReadonlyMap<string, string>;
  dragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragging: (value: boolean) => void;
  onAddFiles: (files: FileList | null) => void;
  onDropFile: (fileName: string) => void;
  onAssign: (fileName: string, sectionId: string) => void;
  onToggleOverwrite: (value: boolean) => void;
  onReset: () => void;
  onRun: () => void;
  onClose: () => void;
}) {
  // ===================================================================
  // Màn tiến độ
  // ===================================================================
  if (phase === "compressing" || phase === "uploading") {
    const compressing = phase === "compressing";
    return (
      <div className="space-y-3 py-6">
        <p aria-live="polite" className="text-sm font-medium">
          {compressing ? "Đang nén ảnh" : "Đang tải ảnh"} {progress.done}/
          {progress.total}…
        </p>
        <Progress
          value={progress.done}
          max={progress.total}
          label={
            compressing
              ? `Đã nén ${progress.done} trên ${progress.total} ảnh`
              : `Đã tải ${progress.done} trên ${progress.total} ảnh`
          }
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
              {result.failedFiles.length} ảnh không tải được:{" "}
              {result.failedFiles.join(", ")}. Chọn lại đúng những ảnh đó rồi
              chạy thêm một lượt.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onReset}>
            Gắn tiếp lượt nữa
          </Button>
          <Button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            Xong
          </Button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // Màn chọn ảnh
  // ===================================================================
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Bộ này có <strong>{deckSectionCount} buổi</strong>, trong đó{" "}
        <strong>{draftTargets.length} buổi còn ở bản nháp</strong> và nhận được
        ảnh. Buổi đã công bố được giữ nguyên — đưa về nháp rồi chạy lại nếu muốn
        thay.
      </p>

      {/*
        Kéo–thả chỉ là BỔ TRỢ. `<input type="file">` thật luôn có mặt và `<label>`
        bọc ngoài nên bấm/Tab/Enter đều mở được hộp chọn file — luật
        `gesture-alternative`.
      */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          onDragging(true);
        }}
        onDragLeave={() => onDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragging(false);
          onAddFiles(event.dataTransfer.files);
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
            onAddFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Images className="mx-auto size-6" aria-hidden />
        <span className="mt-2 block font-medium">
          Kéo thả ảnh vào đây, hoặc bấm để chọn ảnh
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          JPG · PNG · WEBP, mỗi ảnh ≤ 8 MB · một ảnh cho mỗi buổi
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          Tên file phải chứa <strong>đúng một dãy số</strong> — đó là số buổi:{" "}
          <code>01.png</code>, <code>buoi-01.webp</code>,{" "}
          <code>bia-buoi-12.jpg</code>. Tên có nhiều dãy số thì gán tay bên dưới.
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
              {files.length} ảnh · gắn được{" "}
              {summary.attachCount + summary.replaceCount} · chưa khớp{" "}
              {summary.unmatchedCount}
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="flashcard-cover-overwrite"
                checked={allowOverwrite}
                onCheckedChange={(next) => onToggleOverwrite(next === true)}
              />
              <Label
                htmlFor="flashcard-cover-overwrite"
                className="cursor-pointer text-sm font-normal"
              >
                Ghi đè ảnh mở đầu đã có{" "}
                <span className="text-muted-foreground">
                  (xoá hẳn ảnh cũ, không hoàn tác được)
                </span>
              </Label>
            </div>
          </div>

          <DataTable
            caption="Đối chiếu từng buổi với ảnh sẽ gắn, trước khi chạy"
            minWidthClass="min-w-[48rem]"
          >
            <thead>
              <tr>
                <th scope="col">Buổi</th>
                <th scope="col">Tên buổi</th>
                <th scope="col">Ảnh mở đầu hiện có</th>
                <th scope="col">Ảnh sẽ gắn</th>
                <th scope="col">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const status = coverStatus(row.plan);
                return (
                  <tr key={row.target.sectionId}>
                    <td className="tabular-nums">{row.target.sessionNumber}</td>
                    <td>{row.target.title}</td>
                    <td>
                      {row.target.hasCover ? (
                        "Đã có"
                      ) : (
                        <span className="text-muted-foreground">Chưa có</span>
                      )}
                    </td>
                    <td>
                      <CoverFileCell plan={row.plan} />
                    </td>
                    <td>
                      <StatusBadge label={status.label} tone={status.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          {summary.publishedCount > 0 && (
            <Alert>
              <AlertDescription>
                {summary.publishedCount} ảnh rơi vào buổi <strong>đã công
                bố</strong> nên sẽ không được gắn. Đưa những buổi đó về nháp rồi
                chạy lại — lưu ý mã QR đã in của chúng sẽ ngừng hoạt động trong
                lúc buổi ở trạng thái nháp.
              </AlertDescription>
            </Alert>
          )}

          {plan.unmatched.length > 0 && (
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="text-sm font-semibold">
                {plan.unmatched.length} ảnh chưa khớp buổi nào
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
                      id={`assign-cover-${item.fileName}`}
                      aria-label={`Gán "${item.fileName}" cho buổi`}
                      value={overrides.get(item.fileName) ?? ""}
                      onChange={(event) =>
                        onAssign(item.fileName, event.target.value)
                      }
                    >
                      <option value="">Gán cho buổi…</option>
                      {draftTargets.map((target) => (
                        <option key={target.sectionId} value={target.sectionId}>
                          Buổi {target.sessionNumber}. {target.title}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Bỏ ảnh ${item.fileName} ra khỏi lượt này`}
                      onClick={() => onDropFile(item.fileName)}
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
                {summary.replaceCount} ảnh mở đầu cũ sẽ bị <strong>xoá hẳn</strong>{" "}
                và không lấy lại được. Tắt ô &ldquo;Ghi đè&rdquo; nếu bạn chỉ
                muốn gắn cho buổi đang trống.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onReset}>
              Bỏ hết ảnh
            </Button>
            <Button
              type="button"
              disabled={uploadCount === 0}
              onClick={() => {
                if (
                  summary.replaceCount > 0 &&
                  !window.confirm(
                    `Sẽ xoá hẳn ${summary.replaceCount} ảnh mở đầu cũ và không lấy lại được. Tiếp tục?`,
                  )
                ) {
                  return;
                }
                onRun();
              }}
            >
              {phase !== "select" && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Gắn cho {summary.sessionCount} buổi
              {summary.replaceCount > 0 &&
                ` · thay ${summary.replaceCount} ảnh`}
            </Button>
          </div>
        </>
      )}

      {files.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Chưa chọn ảnh nào. Tối đa {MAX_FLASHCARD_COVER_UPLOAD_FILES} ảnh mỗi
          lượt.
        </p>
      )}
    </div>
  );
}
