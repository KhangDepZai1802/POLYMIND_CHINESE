"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  correctB2CTuitionAction,
  getB2CCorrectionsAction,
  getB2CReceiptsAction,
} from "../server/tuition-actions";
import type {
  B2CCorrectionHistory,
  B2CReceipt,
  B2CTuitionRow,
} from "../tuition-schema";
import { formatCurrency } from "@/lib/dates";

const labels = {
  cancel: "Hủy phiếu thu nhầm",
  refund: "Hoàn tiền",
  adjust: "Điều chỉnh phải thu",
};
const selectClass =
  "border-input bg-background min-h-11 w-full rounded-md border px-3 text-sm";

export function TuitionCorrectionsDialog({
  row,
  today,
}: {
  row: B2CTuitionRow;
  today: string;
}) {
  const router = useRouter();
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<keyof typeof labels>("refund");
  const [receipts, setReceipts] = useState<B2CReceipt[]>([]);
  const [receiptId, setReceiptId] = useState("");
  const [receiptPage, setReceiptPage] = useState(0);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [history, setHistory] = useState<B2CCorrectionHistory | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [amount, setAmount] = useState("");
  const [reduceFee, setReduceFee] = useState(true);
  const receipt = receipts.find((r) => r.id === receiptId);
  const money =
    kind === "cancel" ? Number(receipt?.amount ?? 0) : Number(amount);
  const nextPaid = row.paid_amount - (kind === "adjust" ? 0 : money);
  const nextDue =
    kind === "adjust"
      ? money
      : row.total_due! - (kind === "refund" && reduceFee ? money : 0);

  async function load(rPage: number, hPage: number) {
    if (!row.package_id) return;
    const token = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const [r, h] = await Promise.all([
        getB2CReceiptsAction(row.package_id, rPage),
        getB2CCorrectionsAction(row.package_id, hPage),
      ]);
      if (token !== generation.current) return;
      if (r.error) throw new Error(r.error);
      setReceipts(r.receipts);
      setReceiptTotal(r.total);
      setHistory(h);
      setReceiptPage(rPage);
      setHistoryPage(hPage);
      setReceiptId("");
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (saving) return;
        setOpen(value);
        if (value) {
          setRequestId(crypto.randomUUID());
          setKind("refund");
          setAmount("");
          setReduceFee(true);
          setReceipts([]);
          setHistory(null);
          setReceiptId("");
          void load(0, 0);
        } else generation.current++;
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!row.package_id}>
          Xử lý học phí
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Xử lý học phí</DialogTitle>
          <DialogDescription>
            {row.full_name} · {row.class_name} · Phải thu{" "}
            {formatCurrency(row.total_due ?? 0)} · Thu ròng{" "}
            {formatCurrency(row.paid_amount)}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status">Đang tải…</p>
        ) : (
          <>
            <form
              key={requestId}
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving || !row.package_id) return;
                const form = new FormData(event.currentTarget);
                setSaving(true);
                setError("");
                try {
                  const result = await correctB2CTuitionAction({
                    request_id: requestId,
                    package_id: row.package_id,
                    receipt_id: kind === "adjust" ? null : receiptId,
                    kind,
                    amount: money,
                    reason: form.get("reason"),
                    effective_date: form.get("date"),
                    method: form.get("method"),
                    reduce_fee: kind === "refund" && reduceFee,
                    expected_due: row.total_due,
                    expected_paid: row.paid_amount,
                  });
                  if (result.error) setError(result.error);
                  else {
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  setError(
                    "Chưa xác nhận được kết quả. Giữ nguyên nội dung và thử lưu lại.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <fieldset disabled={saving || !history} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="correction-kind">Thao tác</Label>
                  <select
                    id="correction-kind"
                    className={selectClass}
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as keyof typeof labels);
                      setAmount("");
                      setRequestId(crypto.randomUUID());
                    }}
                  >
                    {Object.entries(labels).map(([v, text]) => (
                      <option key={v} value={v}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>
                {kind !== "adjust" && (
                  <div className="space-y-2">
                    <Label htmlFor="correction-receipt">Phiếu thu gốc *</Label>
                    <select
                      id="correction-receipt"
                      className={selectClass}
                      required
                      value={receiptId}
                      onChange={(e) => setReceiptId(e.target.value)}
                    >
                      <option value="">Chọn phiếu thu</option>
                      {receipts
                        .filter(
                          (r) =>
                            !r.cancelled_at &&
                            Number(r.effective_amount ?? r.amount) > 0 &&
                            (kind !== "cancel" || !Number(r.refunded_amount)),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.code} · {r.paid_date} · Còn{" "}
                            {formatCurrency(
                              Number(r.effective_amount ?? r.amount),
                            )}
                          </option>
                        ))}
                    </select>
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={receiptPage === 0}
                        onClick={() => void load(receiptPage - 1, historyPage)}
                      >
                        Phiếu trước
                      </Button>
                      <span className="text-xs">
                        Trang {receiptPage + 1} · {receiptTotal} phiếu
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={(receiptPage + 1) * 20 >= receiptTotal}
                        onClick={() => void load(receiptPage + 1, historyPage)}
                      >
                        Phiếu sau
                      </Button>
                    </div>
                  </div>
                )}
                {kind !== "cancel" && (
                  <div className="space-y-2">
                    <Label htmlFor="correction-amount">
                      {kind === "refund"
                        ? "Số tiền hoàn (VNĐ)"
                        : "Tổng phải thu mới (VNĐ)"}{" "}
                      *
                    </Label>
                    <Input
                      id="correction-amount"
                      type="number"
                      min={kind === "refund" ? 1 : row.paid_amount}
                      max={
                        kind === "refund"
                          ? Number(receipt?.effective_amount ?? 0)
                          : (row.sessions ?? 0) * (row.unit_price ?? 0)
                      }
                      step={1}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                )}
                {kind === "refund" && (
                  <div className="space-y-2">
                    <Label htmlFor="correction-reduce">
                      Khoản phải thu sau hoàn
                    </Label>
                    <select
                      id="correction-reduce"
                      className={selectClass}
                      value={String(reduceFee)}
                      onChange={(e) => setReduceFee(e.target.value === "true")}
                    >
                      <option value="true">
                        Giảm học phí tương ứng số hoàn (nghỉ học/giảm phí)
                      </option>
                      <option value="false">
                        Giữ học phí — số hoàn trở thành còn phải thu
                      </option>
                    </select>
                  </div>
                )}
                <p className="text-muted-foreground text-sm">
                  {kind === "cancel"
                    ? "Dùng khi ghi nhận thu nhầm. Phiếu gốc được giữ và đánh dấu đã hủy; khoản phải thu giữ nguyên."
                    : kind === "adjust"
                      ? "Điều chỉnh bằng chiết khấu; muốn tăng vượt tạm tính, sửa số buổi hoặc đơn giá trong Gói học phí."
                      : "Ghi nhận tiền đã hoàn thực tế; không tự chuyển tiền qua ngân hàng."}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="correction-date">Ngày xử lý *</Label>
                    <Input
                      id="correction-date"
                      name="date"
                      type="date"
                      required
                      defaultValue={today}
                      max={today}
                      min={kind !== "adjust" ? receipt?.paid_date : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="correction-method">Hình thức hoàn</Label>
                    <select
                      id="correction-method"
                      name="method"
                      className={selectClass}
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correction-reason">Lý do *</Label>
                  <Input
                    id="correction-reason"
                    name="reason"
                    required
                    maxLength={1000}
                  />
                </div>
                {Number.isFinite(money) && (amount !== "" || receipt) && (
                  <p className="rounded-md border p-3 text-sm">
                    Sau xử lý: phải thu {formatCurrency(nextDue)} · thu ròng{" "}
                    {formatCurrency(nextPaid)} · còn nợ{" "}
                    {formatCurrency(nextDue - nextPaid)}
                  </p>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? "Đang lưu…" : "Xác nhận lưu xử lý"}
                </Button>
              </fieldset>
            </form>
            {history && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="font-medium">Lịch sử xử lý ({history.total})</h3>
                {history.rows.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Chưa có xử lý học phí.
                  </p>
                )}
                {history.rows.map((h) => (
                  <article
                    key={h.id}
                    className="space-y-1 rounded-md border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {labels[h.kind]} · {formatCurrency(h.amount)}{" "}
                      {h.receipt_code && `· ${h.receipt_code}`}
                    </p>
                    <p>{h.reason}</p>
                    <p>
                      {h.actor_name ?? "—"} · {h.effective_date} ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(h.created_at))}
                    </p>
                    {h.kind === "refund" && (
                      <p>
                        {h.method === "cash" ? "Tiền mặt" : "Chuyển khoản"} ·{" "}
                        {h.reduce_fee
                          ? "Giảm khoản phải thu"
                          : "Giữ khoản phải thu"}
                      </p>
                    )}
                    <p>
                      Phải thu: {formatCurrency(h.before_data.total_due)} →{" "}
                      {formatCurrency(h.after_data.total_due)} · Thu ròng:{" "}
                      {formatCurrency(h.before_data.paid_amount)} →{" "}
                      {formatCurrency(h.after_data.paid_amount)}
                    </p>
                  </article>
                ))}
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    disabled={saving || historyPage === 0}
                    onClick={() => void load(receiptPage, historyPage - 1)}
                  >
                    Lịch sử trước
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={saving || (historyPage + 1) * 20 >= history.total}
                    onClick={() => void load(receiptPage, historyPage + 1)}
                  >
                    Lịch sử sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="text-destructive text-sm">
            {error}
            {!history && (
              <Button variant="outline" onClick={() => void load(0, 0)}>
                Thử tải lại
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
