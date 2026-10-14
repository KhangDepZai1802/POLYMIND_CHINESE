"use client";
import { useRef, useState } from "react";
import { ArrowRight, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import {
  PIPELINE_STAGES,
  STAGE_CODES,
  type PipelineCard,
  type PipelineStage,
  type ProgressEvent,
  type SearchPage,
} from "@/features/xkld/domain/pipeline";
import {
  transitionCandidateAction,
  searchPipelineClassesAction,
  searchPipelineOrdersAction,
  getProgressHistoryAction,
} from "@/features/xkld/server/pipeline-actions";
type Option = { id: string; label: string };
function LinkPicker({
  kind,
  selected,
  onChange,
}: {
  kind: "class" | "order";
  selected: Option | null;
  onChange: (v: Option | null) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const serial = useRef(0);
  const label = kind === "class" ? "Lớp B2C" : "Đơn hàng";
  async function search(next: number) {
    const seq = ++serial.current;
    setPending(true);
    setError("");
    try {
      if (kind === "class") {
        const result = await searchPipelineClassesAction(q, next);
        if (seq !== serial.current) return;
        if (result.error) setError(result.error);
        else if (result.data) {
          setRows(
            result.data.rows.map((r) => ({
              id: r.id,
              label: `${r.code} · ${r.name}`,
            })),
          );
          setTotal(result.data.total);
          setPage(next);
        }
      } else {
        const result = await searchPipelineOrdersAction(q, next);
        if (seq !== serial.current) return;
        if (result.error) setError(result.error);
        else if (result.data) {
          setRows(
            result.data.rows.map((r) => ({
              id: r.id,
              label: `${r.code} · ${r.employer} · ${r.country_name}`,
            })),
          );
          setTotal(result.data.total);
          setPage(next);
        }
      }
    } catch {
      if (seq === serial.current)
        setError("Không tải được danh sách. Vui lòng thử lại.");
    } finally {
      if (seq === serial.current) setPending(false);
    }
  }
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{label} liên kết</legend>
      {selected && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-blue-50 p-2 text-sm">
          <span className="min-w-0 break-words">{selected.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            Bỏ chọn
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={`Tìm ${label.toLowerCase()} liên kết`}
          value={q}
          maxLength={200}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            kind === "class" ? "Mã hoặc tên lớp" : "Mã hoặc chủ sử dụng"
          }
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => search(0)}
        >
          <Search className="size-4" aria-hidden />
          Tìm
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {kind === "class"
          ? "Chỉ tra mã/tên lớp dự kiến hoặc đang học; không đọc hồ sơ hay học phí B2C."
          : "Chỉ chọn đơn hàng đang tuyển và còn hạn."}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <Button
            key={row.id}
            type="button"
            variant={selected?.id === row.id ? "secondary" : "ghost"}
            className="h-auto w-full justify-start text-left whitespace-normal"
            onClick={() => onChange(row)}
          >
            {row.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>
          {total} kết quả{total > 0 ? ` · Trang ${page + 1}` : ""}
        </span>
        <div className="flex gap-1">
          {page > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => search(page - 1)}
            >
              Trước
            </Button>
          )}
          {(page + 1) * 20 < total && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => search(page + 1)}
            >
              Sau
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  );
}
export function PipelineDialog({ candidate }: { candidate: PipelineCard }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<PipelineStage>(candidate.stage);
  const [order, setOrder] = useState<Option | null>(null);
  const [b2c, setB2c] = useState<Option | null>(null);
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const { state, formAction } = useFormAction(transitionCandidateAction, {
    onSuccess: () => {
      setOpen(false);
      // The server action revalidates this page in the same response.
    },
  });
  const old = STAGE_CODES.indexOf(candidate.stage);
  const rollback = STAGE_CODES.indexOf(stage) < old;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setStage(candidate.stage);
          setOrder(
            candidate.order_id
              ? {
                  id: candidate.order_id,
                  label: `${candidate.order_code} · ${candidate.order_employer}`,
                }
              : null,
          );
          setB2c(
            candidate.b2c_class_id
              ? {
                  id: candidate.b2c_class_id,
                  label: candidate.class_label ?? "Lớp đã liên kết",
                }
              : null,
          );
          setNote("");
          setRequestId(crypto.randomUUID());
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowRight className="size-4" aria-hidden />
          Cập nhật bước
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pipeline · {candidate.code}</DialogTitle>
          <DialogDescription>
            {candidate.full_name} · {PIPELINE_STAGES[candidate.stage]}. Tiến lần
            lượt từng bước; quay lại cần ghi lý do.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <input
              type="hidden"
              name="expected_updated_at"
              value={candidate.updated_at}
            />
            <input type="hidden" name="request_id" value={requestId} />
            <input type="hidden" name="order_id" value={order?.id ?? ""} />
            <input type="hidden" name="b2c_class_id" value={b2c?.id ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor={`stage-${candidate.id}`}>Giai đoạn</Label>
              <select
                id={`stage-${candidate.id}`}
                name="stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                {STAGE_CODES.map((code, i) => (
                  <option key={code} value={code} disabled={i > old + 1}>
                    {i + 1}. {PIPELINE_STAGES[code]}
                  </option>
                ))}
              </select>
            </div>
            <LinkPicker kind="order" selected={order} onChange={setOrder} />
            {state.fieldErrors?.order_id && (
              <p className="text-destructive text-sm">
                {state.fieldErrors.order_id}
              </p>
            )}
            <LinkPicker kind="class" selected={b2c} onChange={setB2c} />
            {state.fieldErrors?.b2c_class_id && (
              <p className="text-destructive text-sm">
                {state.fieldErrors.b2c_class_id}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`note-${candidate.id}`}>
                {rollback ? "Lý do quay lại *" : "Ghi chú"}
              </Label>
              <Textarea
                id={`note-${candidate.id}`}
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                required={rollback}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Đăng ký/đặt cọc là trạng thái theo dõi, chưa ghi nhận thu tiền.
              Liên kết lớp không tự ghi danh hoặc thay đổi học phí B2C.
            </p>
            {state.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton>Lưu bước</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function ProgressHistoryDialog({
  candidate,
}: {
  candidate: PipelineCard;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchPage<ProgressEvent>>({
    rows: [],
    total: 0,
  });
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const serial = useRef(0);
  async function load(next: number) {
    const seq = ++serial.current;
    setPending(true);
    setError("");
    try {
      const result = await getProgressHistoryAction(candidate.id, next);
      if (seq !== serial.current) return;
      if (result.error) setError(result.error);
      else if (result.data) {
        setData(result.data);
        setPage(next);
      }
    } catch {
      if (seq === serial.current) setError("Không tải được lịch sử.");
    } finally {
      if (seq === serial.current) setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setData({ rows: [], total: 0 });
          load(0);
        } else serial.current++;
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <History className="size-4" aria-hidden />
          Lịch sử
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử · {candidate.code}</DialogTitle>
          <DialogDescription>
            {candidate.full_name}. Thời gian theo Việt Nam; chỉ ghi nhận từ khi
            bật pipeline.
          </DialogDescription>
        </DialogHeader>
        {pending && <p role="status">Đang tải lịch sử…</p>}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <ol className="space-y-3">
          {data.rows.map((event) => (
            <li
              key={event.id}
              className="space-y-1 rounded-lg border p-3 text-sm"
            >
              <p className="font-medium">
                {event.from_stage
                  ? PIPELINE_STAGES[event.from_stage]
                  : "Tiếp nhận"}{" "}
                → {PIPELINE_STAGES[event.to_stage]}
              </p>
              <p>
                {event.actor_name ?? "Hệ thống / ngoài phiên đăng nhập"} ·{" "}
                {new Date(event.created_at).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </p>
              {event.old_order_code !== event.new_order_code && (
                <p>
                  Đơn hàng: {event.old_order_code ?? "Chưa gắn"} →{" "}
                  {event.new_order_code ?? "Chưa gắn"}
                </p>
              )}
              {event.old_class_label !== event.new_class_label && (
                <p>
                  Lớp B2C: {event.old_class_label ?? "Chưa liên kết"} →{" "}
                  {event.new_class_label ?? "Chưa liên kết"}
                </p>
              )}
              {event.note && (
                <p className="break-words whitespace-pre-wrap">{event.note}</p>
              )}
            </li>
          ))}
        </ol>
        {!pending && !error && !data.rows.length && (
          <p className="text-muted-foreground text-sm">
            Chưa có lịch sử chuyển bước.
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span>{data.total} cập nhật</span>
          <div className="flex gap-2">
            {page > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => load(page - 1)}
              >
                Trước
              </Button>
            )}
            {(page + 1) * 20 < data.total && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => load(page + 1)}
              >
                Sau
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
