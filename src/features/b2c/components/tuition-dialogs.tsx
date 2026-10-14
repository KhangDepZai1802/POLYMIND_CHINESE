"use client";
import { useState } from "react";
import { Pencil, Plus, Receipt } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import { formatCurrency } from "@/lib/dates";
import type { B2CTuitionRow } from "@/features/b2c/tuition-schema";
import {
  saveB2CTuitionPackageAction,
  recordB2CReceiptAction,
  getB2CReceiptsAction,
} from "@/features/b2c/server/tuition-actions";

export function TuitionPackageDialog({
  row,
  classId,
}: {
  row: B2CTuitionRow;
  classId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(row.sessions ?? 1);
  const [price, setPrice] = useState(row.unit_price ?? 0);
  const [discount, setDiscount] = useState(row.discount ?? 0);
  const { state, formAction } = useFormAction(saveB2CTuitionPackageAction, {
    onSuccess: () => {
      setOpen(false);
    },
  });
  const key = row.enrollment_id;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setSessions(row.sessions ?? 1);
          setPrice(row.unit_price ?? 0);
          setDiscount(row.discount ?? 0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${row.package_id ? "Sửa" : "Thêm"} gói học phí ${row.full_name}`}
        >
          {row.package_id ? (
            <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gói học phí</DialogTitle>
          <DialogDescription>
            {row.full_name} · {row.class_name}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={key} />
          {classId && <input type="hidden" name="class_id" value={classId} />}
          <div className="space-y-2">
            <Label htmlFor={`sessions-${key}`}>Số buổi *</Label>
            <Input
              id={`sessions-${key}`}
              name="sessions"
              type="number"
              min={1}
              max={100000}
              step={1}
              required
              value={sessions}
              onChange={(e) => setSessions(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`price-${key}`}>Đơn giá / buổi (VNĐ) *</Label>
            <Input
              id={`price-${key}`}
              name="unit_price"
              type="number"
              min={0}
              max={999999999999}
              step={1}
              required
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`discount-${key}`}>Chiết khấu (VNĐ)</Label>
            <Input
              id={`discount-${key}`}
              name="discount"
              type="number"
              min={0}
              max={sessions * price}
              step={1}
              required
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${key}`}>
              Lý do chiết khấu{discount > 0 ? " *" : ""}
            </Label>
            <Input
              id={`reason-${key}`}
              name="discount_reason"
              required={discount > 0}
              maxLength={1000}
              defaultValue={row.discount_reason ?? ""}
            />
          </div>
          <p className="font-semibold">
            Tổng phải thu: {formatCurrency(sessions * price - discount)}
          </p>
          <p className="text-muted-foreground text-sm">
            Đã thu {formatCurrency(row.paid_amount)}. Tổng phải thu không được
            thấp hơn số đã thu.
          </p>
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          {state.fieldErrors && (
            <p role="alert" className="text-destructive text-sm">
              {Object.values(state.fieldErrors).flat().join(" ")}
            </p>
          )}
          <DialogFooter>
            <SubmitButton>Lưu gói học phí</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TuitionReceiptsDialog({
  row,
  collector,
  today,
  classId,
}: {
  row: B2CTuitionRow;
  collector: string;
  today: string;
  classId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof getB2CReceiptsAction>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const { state, formAction } = useFormAction(recordB2CReceiptAction, {
    onSuccess: () => {
      setOpen(false);
    },
  });
  async function load(next: number) {
    if (!row.package_id) return;
    setLoading(true);
    setPage(next);
    setHistory(null);
    try {
      setHistory(await getB2CReceiptsAction(row.package_id, next));
    } catch {
      setHistory({
        receipts: [],
        total: 0,
        error: "Không tải được phiếu thu. Vui lòng mở lại.",
      });
    } finally {
      setLoading(false);
    }
  }
  const key = row.enrollment_id;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setRequestId(crypto.randomUUID());
          void load(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!row.package_id}>
          <Receipt className="size-4" aria-hidden />
          Phiếu thu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Phiếu thu</DialogTitle>
          <DialogDescription>
            {row.full_name} · {row.class_name} · Còn phải thu{" "}
            {formatCurrency(row.balance)}
          </DialogDescription>
        </DialogHeader>
        {row.balance > 0 && (
          <form action={formAction} className="space-y-4 border-b pb-4">
            {classId && <input type="hidden" name="class_id" value={classId} />}
            <input
              type="hidden"
              name="package_id"
              value={row.package_id ?? ""}
            />
            <input type="hidden" name="request_id" value={requestId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`date-${key}`}>Ngày thu *</Label>
                <Input
                  id={`date-${key}`}
                  name="paid_date"
                  type="date"
                  required
                  defaultValue={today}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`amount-${key}`}>Số tiền (VNĐ) *</Label>
                <Input
                  id={`amount-${key}`}
                  name="amount"
                  type="number"
                  min={1}
                  max={row.balance}
                  step={1}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`method-${key}`}>Hình thức *</Label>
                <select
                  id={`method-${key}`}
                  name="method"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="cash">Tiền mặt (TM)</option>
                  <option value="bank_transfer">Chuyển khoản (CK)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`collector-${key}`}>Người thu *</Label>
                <Input
                  id={`collector-${key}`}
                  name="collector_name"
                  required
                  maxLength={200}
                  defaultValue={collector}
                />
              </div>
            </div>
            {state.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}
            {state.fieldErrors && (
              <p role="alert" className="text-destructive text-sm">
                {Object.values(state.fieldErrors).flat().join(" ")}
              </p>
            )}
            <DialogFooter>
              <SubmitButton>Lưu phiếu thu</SubmitButton>
            </DialogFooter>
          </form>
        )}
        <div className="space-y-3">
          <p className="font-medium">Lịch sử thu tiền</p>
          {loading ? (
            <p role="status">Đang tải…</p>
          ) : history?.error ? (
            <p role="alert" className="text-destructive">
              {history.error}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Mã phiếu",
                        "Ngày thu",
                        "Số tiền",
                        "Hình thức",
                        "Người thu",
                      ].map((h) => (
                        <th key={h} className="pr-3 pb-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history?.receipts.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-3">{r.code}</td>
                        <td className="pr-3">
                          {r.paid_date.split("-").reverse().join("/")}
                        </td>
                        <td className="pr-3">{formatCurrency(r.amount)}</td>
                        <td className="pr-3">
                          {r.method === "cash" ? "TM" : "CK"}
                        </td>
                        <td>{r.collector_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history?.total === 0 && (
                <p className="text-muted-foreground text-sm">
                  Chưa có phiếu thu.
                </p>
              )}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => void load(page - 1)}
                >
                  Trước
                </Button>
                <span className="text-sm">
                  Trang {page + 1} · {history?.total ?? 0} phiếu
                </span>
                <Button
                  variant="ghost"
                  disabled={(page + 1) * 20 >= (history?.total ?? 0)}
                  onClick={() => void load(page + 1)}
                >
                  Sau
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
