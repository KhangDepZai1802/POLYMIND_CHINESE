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
import {
  FINANCE_KINDS,
  TRANSACTION_KINDS,
  moneyVnd,
  type FinanceKind,
  type FinanceInstallment,
  type FinanceTransaction,
  type FinanceHistory,
} from "../domain/finance";
import {
  saveFinanceInstallmentAction,
  recordFinanceTransactionAction,
  voidFinanceTransactionAction,
  getFinanceTransactionsAction,
  getFinanceHistoryAction,
} from "../server/finance-actions";

const fieldClass = "grid gap-1 text-sm";
export function InstallmentDialog({
  candidateId,
  candidateName,
  kind,
  installment,
}: {
  candidateId: string;
  candidateName: string;
  kind: FinanceKind;
  installment?: FinanceInstallment;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={installment ? "outline" : "default"}>
          {installment ? "Sửa đợt phí" : "Thêm đợt phí"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {installment ? "Sửa đợt phí" : "Thêm đợt phí"}
          </DialogTitle>
          <DialogDescription>
            {FINANCE_KINDS[kind]} · VNĐ. Mỗi đợt có hạn và số tiền riêng.
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
              const result = await saveFinanceInstallmentAction({
                id: installment?.id,
                request_id: request,
                candidate_id: candidateId,
                kind,
                title: f.get("title"),
                counterparty: f.get("counterparty"),
                amount: f.get("amount"),
                due_date: f.get("due_date"),
                note: f.get("note"),
                expected_updated_at: installment?.updated_at,
              });
              if (result.error) setError(result.error);
              else setOpen(false);
            } catch {
              setError("Không lưu được đợt phí. Vui lòng thử lại.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={fieldClass}>
            Tên đợt phí
            <Input
              name="title"
              required
              maxLength={200}
              defaultValue={installment?.title}
            />
          </label>
          <label className={fieldClass}>
            {kind === "commission"
              ? "CTV nhận hoa hồng"
              : kind === "partner_fee"
                ? "Đối tác/chủ sử dụng trả phí"
                : "Người đóng phí"}
            <Input
              name="counterparty"
              required
              maxLength={200}
              defaultValue={
                installment?.counterparty ??
                (kind === "candidate_fee" ? candidateName : "")
              }
            />
          </label>
          <label className={fieldClass}>
            {kind === "commission"
              ? "Hoa hồng phải chi (VNĐ)"
              : "Phí phải thu hiện tại (VNĐ)"}
            <Input
              name="amount"
              type="number"
              required
              min={installment ? 0 : 1}
              max={999999999999}
              step={1}
              defaultValue={installment?.amount}
            />
          </label>
          <label className={fieldClass}>
            Hạn thu/chi
            <Input
              name="due_date"
              type="date"
              required
              min="1900-01-01"
              defaultValue={installment?.due_date}
            />
          </label>
          <label className={fieldClass}>
            Ghi chú
            <textarea
              name="note"
              maxLength={2000}
              defaultValue={installment?.note ?? ""}
              className="min-h-20 rounded border p-2"
            />
          </label>
          {installment && (
            <p className="text-muted-foreground text-xs">
              Sửa phí không thay đổi phiếu đã ghi. Phí không được thấp hơn thực
              thu/đã chi ròng; mọi thay đổi được lưu lịch sử.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu đợt phí"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function TransactionDialog({
  installment,
  today,
  receipt,
  onSuccess,
}: {
  installment: FinanceInstallment;
  today: string;
  receipt?: FinanceTransaction;
  onSuccess?: () => void;
}) {
  const kind = receipt
    ? "refund"
    : installment.kind === "commission"
      ? "commission_payment"
      : "receipt";
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={!receipt && installment.balance <= 0}
        >
          {TRANSACTION_KINDS[kind]}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TRANSACTION_KINDS[kind]}</DialogTitle>
          <DialogDescription>
            {installment.code} · {installment.title}
            {receipt
              ? ` · Phiếu gốc ${receipt.code}`
              : ` · Còn ${moneyVnd(installment.balance)}`}
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
              const result = await recordFinanceTransactionAction({
                request_id: request,
                installment_id: installment.id,
                kind,
                receipt_id: receipt?.id,
                amount: f.get("amount"),
                reduce_fee: f.get("refund_policy") === "reduce",
                occurred_on: f.get("occurred_on"),
                method: f.get("method"),
                note: f.get("note"),
              });
              if (result.error) setError(result.error);
              else {
                setOpen(false);
                onSuccess?.();
              }
            } catch {
              setError("Không ghi được phiếu. Vui lòng thử lại.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={fieldClass}>
            Số tiền (VNĐ)
            <Input
              name="amount"
              type="number"
              required
              min={1}
              max={receipt ? receipt.amount : installment.balance}
              step={1}
            />
          </label>
          <label className={fieldClass}>
            Ngày thu/chi
            <Input
              name="occurred_on"
              type="date"
              required
              min={receipt?.occurred_on ?? "1900-01-01"}
              max={today}
              defaultValue={today}
            />
          </label>
          <label className={fieldClass}>
            Hình thức
            <select
              name="method"
              className="bg-background rounded border p-2"
              defaultValue="bank_transfer"
            >
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="cash">Tiền mặt</option>
            </select>
          </label>
          {receipt && (
            <label className={fieldClass}>
              Cách tính công nợ sau hoàn
              <select
                name="refund_policy"
                required
                defaultValue=""
                className="bg-background rounded border p-2"
              >
                <option value="" disabled>
                  Chọn chính sách cho lần hoàn này
                </option>
                <option value="reduce">
                  Hoàn tiền và giảm phí phải thu tương ứng
                </option>
                <option value="keep">Giữ nguyên phí; công nợ tăng lại</option>
              </select>
              <span className="text-muted-foreground text-xs">
                Chỉ hoàn trong số tiền chưa hoàn của phiếu gốc.
              </span>
            </label>
          )}
          <label className={fieldClass}>
            {receipt ? "Lý do hoàn phí" : "Ghi chú"}
            <textarea
              name="note"
              required={!!receipt}
              maxLength={2000}
              className="min-h-20 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang ghi…" : "Ghi phiếu"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function VoidDialog({
  transaction,
  onSuccess,
}: {
  transaction: FinanceTransaction;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setRequest(crypto.randomUUID());
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Hủy phiếu</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy {transaction.code}</DialogTitle>
          <DialogDescription>
            Phiếu vẫn được giữ trong lịch sử. Hủy sẽ tính lại công nợ; phiếu thu
            có hoàn phí cần hủy phiếu hoàn trước.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const result = await voidFinanceTransactionAction({
                id: transaction.id,
                request_id: request,
                reason: f.get("reason"),
              });
              if (result.error) setError(result.error);
              else {
                setOpen(false);
                onSuccess();
              }
            } catch {
              setError("Không hủy được phiếu.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={fieldClass}>
            Lý do hủy
            <textarea
              name="reason"
              required
              maxLength={2000}
              className="min-h-24 rounded border p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button variant="destructive" disabled={busy} type="submit">
            Xác nhận hủy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function TransactionsDialog({
  installment,
  today,
}: {
  installment: FinanceInstallment;
  today: string;
}) {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [rows, setRows] = useState<FinanceTransaction[]>([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0);
  async function load(next: number) {
    setLoading(true);
    setError("");
    try {
      const result = await getFinanceTransactionsAction(installment.id, next);
      if (result.error) setError(result.error);
      else if (result.data) {
        setRows(result.data.rows);
        setTotal(result.data.total);
        setPage(next);
      }
    } catch {
      setError("Không tải được phiếu.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load(0);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Phiếu thu/chi</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Phiếu: {installment.title}</DialogTitle>
          <DialogDescription>
            Phiếu không sửa/xóa trực tiếp. Hủy kèm lý do rồi lập phiếu đúng; giữ
            người ghi và thời điểm.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p>Đang tải…</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((t) => (
              <article key={t.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {t.code} · {TRANSACTION_KINDS[t.kind]}
                  </strong>
                  <strong>{moneyVnd(t.amount)}</strong>
                </div>
                <p className="mt-1 text-sm">
                  {t.occurred_on.split("-").reverse().join("/")} ·{" "}
                  {t.method === "cash" ? "Tiền mặt" : "Chuyển khoản"} · Người
                  ghi: {t.actor_name}
                </p>
                {t.kind === "refund" && (
                  <p className="mt-1 text-sm">
                    {t.fee_reduction
                      ? `Giảm phí phải thu ${moneyVnd(t.fee_reduction)}`
                      : "Giữ nguyên phí; công nợ tăng lại"}
                  </p>
                )}
                {t.note && (
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {t.note}
                  </p>
                )}
                {t.voided_at ? (
                  <p className="text-destructive mt-2 text-sm">
                    Đã hủy · {t.void_reason}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.kind === "receipt" && (
                      <TransactionDialog
                        installment={installment}
                        today={today}
                        receipt={t}
                        onSuccess={() => void load(page)}
                      />
                    )}
                    <VoidDialog
                      transaction={t}
                      onSuccess={() => void load(page)}
                    />
                  </div>
                )}
              </article>
            ))}
            {!rows.length && <p>Chưa có phiếu thu/chi.</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => void load(page - 1)}
          >
            Trước
          </Button>
          <span>
            {total} phiếu · Trang {page + 1}
          </span>
          <Button
            variant="outline"
            disabled={loading || (page + 1) * 20 >= total}
            onClick={() => void load(page + 1)}
          >
            Sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
const HISTORY_LABELS: Record<string, string> = {
  create_installment: "Tạo đợt phí",
  edit_installment: "Sửa đợt phí",
  record_receipt: "Ghi thu tiền",
  record_refund: "Ghi hoàn phí",
  record_commission_payment: "Ghi chi hoa hồng",
  void_receipt: "Hủy phiếu thu",
  void_refund: "Hủy phiếu hoàn",
  void_commission_payment: "Hủy phiếu chi hoa hồng",
};
function snapshot(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const v = value as Record<string, unknown>;
  if (v.transaction)
    return (
      snapshot(v.transaction) +
      (typeof v.fee_amount === "number"
        ? ` · Phí còn ${moneyVnd(v.fee_amount)}`
        : "")
    );
  return (
    [
      typeof v.code === "string" ? v.code : "",
      typeof v.title === "string" ? v.title : "",
      typeof v.counterparty === "string" ? v.counterparty : "",
      typeof v.amount === "number" ? moneyVnd(v.amount) : "",
      typeof v.due_date === "string"
        ? `Hạn ${v.due_date.split("-").reverse().join("/")}`
        : "",
      typeof v.note === "string" ? v.note : "",
      typeof v.reason === "string" ? v.reason : "",
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}
export function FinanceHistoryDialog({ candidateId }: { candidateId: string }) {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [rows, setRows] = useState<FinanceHistory[]>([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0);
  async function load(next: number) {
    setLoading(true);
    try {
      const r = await getFinanceHistoryAction(candidateId, next);
      if (r.error) setError(r.error);
      else if (r.data) {
        setRows(r.data.rows);
        setTotal(r.data.total);
        setPage(next);
        setError("");
      }
    } catch {
      setError("Không tải được lịch sử.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load(0);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Lịch sử tài chính</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử tài chính</DialogTitle>
          <DialogDescription>
            Người thao tác thật, thời điểm và nội dung trước/sau; lịch sử chỉ
            đọc.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p>Đang tải…</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((h) => (
              <article key={h.id} className="rounded border p-3 text-sm">
                <strong>{HISTORY_LABELS[h.action] ?? h.action}</strong>
                <p>
                  {h.actor_name} ·{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(h.created_at))}
                </p>
                {h.before_data != null && (
                  <p className="mt-2 break-words">
                    Trước: {snapshot(h.before_data)}
                  </p>
                )}
                <p className="mt-2 break-words">
                  Sau: {snapshot(h.after_data)}
                </p>
              </article>
            ))}
            {!rows.length && <p>Chưa có lịch sử.</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => void load(page - 1)}
          >
            Trước
          </Button>
          <span>
            {total} thay đổi · Trang {page + 1}
          </span>
          <Button
            variant="outline"
            disabled={loading || (page + 1) * 20 >= total}
            onClick={() => void load(page + 1)}
          >
            Sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
