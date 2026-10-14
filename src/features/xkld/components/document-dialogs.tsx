"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  saveRequirementAction,
  saveDocumentAction,
  prepareDocumentUploadAction,
  finishDocumentUploadAction,
  cancelDocumentUploadAction,
  listDocumentFilesAction,
} from "../server/document-actions";
import {
  DOCUMENTS_PATH,
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_SIZE,
  type Requirement,
  type DocumentRow,
  type DocumentFile,
} from "../domain/documents";

export function RequirementDialog({
  marketId,
  requirement,
}: {
  marketId: string;
  requirement?: Requirement;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setRequestId(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          {requirement ? "Sửa checklist" : "Thêm giấy tờ"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {requirement
              ? "Sửa giấy tờ yêu cầu"
              : "Thêm giấy tờ theo thị trường"}
          </DialogTitle>
          <DialogDescription>
            Danh mục do trung tâm cấu hình; không tự xác nhận đáp ứng yêu cầu
            pháp lý.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await saveRequirementAction({
                id: requirement?.id,
                request_id: requestId,
                market_id: marketId,
                name: form.get("name"),
                sort_order: Number(form.get("sort_order")),
                is_required: form.has("is_required"),
                expects_expiry: form.has("expects_expiry"),
                is_active: requirement ? form.has("is_active") : true,
                expected_updated_at: requirement?.updated_at,
              });
              if (result.error) setError(result.error);
              else setOpen(false);
            } catch {
              setError("Không lưu được. Vui lòng thử lại.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1">
            Tên giấy tờ
            <Input
              name="name"
              required
              maxLength={200}
              defaultValue={requirement?.name}
            />
          </label>
          <label className="grid gap-1">
            Thứ tự
            <Input
              name="sort_order"
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={requirement?.sort_order ?? 0}
            />
          </label>
          <label>
            <input
              name="is_required"
              type="checkbox"
              defaultChecked={requirement?.is_required ?? true}
            />{" "}
            Bắt buộc
          </label>
          <label>
            <input
              name="expects_expiry"
              type="checkbox"
              defaultChecked={requirement?.expects_expiry}
            />{" "}
            Có ngày hết hạn
          </label>
          {requirement && (
            <label>
              <input
                name="is_active"
                type="checkbox"
                defaultChecked={requirement.is_active}
              />{" "}
              Đang sử dụng
            </label>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Đang lưu…" : "Lưu checklist"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function DocumentDialog({
  candidateId,
  row,
}: {
  candidateId: string;
  row: DocumentRow;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Cập nhật</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.requirement.name}</DialogTitle>
          <DialogDescription>
            Ngày nộp là ngày thực tế. Có thể lưu giấy tờ đã hết hạn để theo dõi
            bổ sung.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await saveDocumentAction({
                candidate_id: candidateId,
                requirement_id: row.requirement.id,
                submitted_on: f.get("submitted_on"),
                expires_on: f.get("expires_on"),
                note: f.get("note"),
                expected_updated_at: row.document?.updated_at ?? null,
              });
              if (result.error) setError(result.error);
              else setOpen(false);
            } catch {
              setError("Không lưu được hồ sơ.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1">
            Ngày nộp
            <Input
              name="submitted_on"
              type="date"
              min="1900-01-01"
              defaultValue={row.document?.submitted_on ?? ""}
            />
          </label>
          <label className="grid gap-1">
            Ngày hết hạn
            <Input
              name="expires_on"
              type="date"
              min="1900-01-01"
              defaultValue={row.document?.expires_on ?? ""}
            />
          </label>
          <label className="grid gap-1">
            Ghi chú
            <textarea
              name="note"
              maxLength={2000}
              defaultValue={row.document?.note ?? ""}
              className="min-h-24 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Đang lưu…" : "Lưu hồ sơ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function DocumentFilesDialog({
  candidateId,
  row,
  canEdit,
}: {
  candidateId: string;
  row: DocumentRow;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [files, setFiles] = useState<DocumentFile[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0);
  async function load(next: number) {
    setLoading(true);
    setError("");
    try {
      if (!row.document) {
        setFiles([]);
        setTotal(0);
        return;
      }
      const result = await listDocumentFilesAction(row.document.id, next);
      if (result.error) setError(result.error);
      else if (result.data) {
        setFiles(result.data.rows);
        setTotal(result.data.total);
        setPage(next);
      }
    } catch {
      setError("Không tải được danh sách tệp.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) void load(0);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Tệp ({row.file_count})</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tệp: {row.requirement.name}</DialogTitle>
          <DialogDescription>
            Kho riêng tư · PDF/PNG/JPG, tối đa 10 MB/tệp. Giữ lại các bản đã tải
            lên.
          </DialogDescription>
        </DialogHeader>
        {canEdit && (
          <label className="grid gap-2 text-sm">
            Tải tệp mới
            <Input
              type="file"
              aria-label="Tải tệp mới"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={busy || loading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > MAX_DOCUMENT_SIZE) {
                  setError("Tệp vượt quá 10 MB.");
                  return;
                }
                setBusy(true);
                setError("");
                let claim: string | undefined;
                try {
                  const prepared = await prepareDocumentUploadAction({
                    candidate_id: candidateId,
                    requirement_id: row.requirement.id,
                    request_id: crypto.randomUUID(),
                    file_name: file.name,
                    mime_type: file.type,
                    size_bytes: file.size,
                  });
                  if (prepared.error || !prepared.data)
                    throw new Error(
                      prepared.error ?? "Không tạo được lượt tải.",
                    );
                  claim = prepared.data.id;
                  const { error: uploadError } = await createClient()
                    .storage.from(DOCUMENT_BUCKET)
                    .upload(prepared.data.storage_path, file, {
                      contentType: file.type,
                      upsert: false,
                    });
                  if (uploadError)
                    throw new Error("Không tải được tệp. Vui lòng thử lại.");
                  const done = await finishDocumentUploadAction(claim);
                  if (done.error) throw new Error(done.error);
                  claim = undefined;
                  setOpen(false);
                } catch (err) {
                  if (claim)
                    await cancelDocumentUploadAction(claim).catch(() => {});
                  setError(
                    err instanceof Error ? err.message : "Không tải được tệp.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        )}
        {busy && <p role="status">Đang tải và kiểm tra tệp…</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p>Đang tải danh sách…</p>
        ) : (
          <ul className="grid gap-3">
            {files.map((file) => (
              <li key={file.id} className="rounded border p-3">
                <a
                  href={`${DOCUMENTS_PATH}/files/${file.id}`}
                  className="text-primary break-all underline"
                >
                  {file.file_name}
                </a>
                <p className="text-muted-foreground text-xs">
                  {(file.size_bytes / 1024).toFixed(1)} KB ·{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(file.uploaded_at))}
                </p>
              </li>
            ))}
            {!files.length && <li>Chưa có tệp đính kèm.</li>}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button
            variant="outline"
            disabled={loading || busy || page === 0}
            onClick={() => void load(page - 1)}
          >
            Trước
          </Button>
          <span>
            {total} tệp · Trang {page + 1}
          </span>
          <Button
            variant="outline"
            disabled={loading || busy || (page + 1) * 20 >= total}
            onClick={() => void load(page + 1)}
          >
            Sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
