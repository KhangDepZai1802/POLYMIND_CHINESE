"use client";
import { useState } from "react";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
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
import {
  saveB2CTuitionPeriodAction,
  startB2CTuitionPeriodAction,
} from "@/features/b2c/server/tuition-period-actions";

type TuitionPackageMode = "edit" | "new";

export function TuitionPackageDialog({
  row,
  classId,
}: {
  row: B2CTuitionRow;
  classId?: string;
}) {
  const refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TuitionPackageMode>("edit");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setMode("edit");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gói học phí</DialogTitle>
          <DialogDescription>
            {row.full_name} · {row.class_name}
            {row.package_id &&
              (mode === "new"
                ? ` · Đợt mới sau đợt ${row.period_no ?? 1}`
                : ` · Đợt ${row.period_no ?? 1}`)}
          </DialogDescription>
        </DialogHeader>
        {row.package_id && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2" aria-label="Thao tác học phí">
              <Button
                type="button"
                variant={mode === "edit" ? "default" : "outline"}
                aria-pressed={mode === "edit"}
                onClick={() => setMode("edit")}
              >
                Sửa đợt này
              </Button>
              {row.is_current !== false && (
                <Button
                  type="button"
                  variant={mode === "new" ? "default" : "outline"}
                  aria-pressed={mode === "new"}
                  onClick={() => setMode("new")}
                >
                  Thêm đợt học phí mới
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {mode === "new"
                ? "Nhập học phí cho đợt học tiếp theo. Phiếu thu và số dư của đợt cũ được giữ riêng."
                : row.is_current === false
                  ? "Sửa giá của đợt đang chọn. Tạo đợt học phí mới từ đợt hiện tại của học viên."
                  : "Sửa giá của đợt đang chọn. Nếu học viên học đợt tiếp theo, hãy thêm đợt học phí mới."}
            </p>
          </div>
        )}
        <TuitionPackageForm
          key={`${row.package_id ?? row.enrollment_id}-${mode}`}
          row={row}
          classId={classId}
          mode={mode}
          onSuccess={() => {
            setOpen(false);
            refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TuitionPackageForm({
  row,
  classId,
  mode,
  onSuccess,
}: {
  row: B2CTuitionRow;
  classId?: string;
  mode: TuitionPackageMode;
  onSuccess: () => void;
}) {
  const isNewPeriod = Boolean(row.package_id) && mode === "new";
  const [sessions, setSessions] = useState<string | number>(
    isNewPeriod ? "" : (row.sessions ?? 1),
  );
  const [price, setPrice] = useState<string | number>(
    isNewPeriod ? "" : (row.unit_price ?? 0),
  );
  const [discount, setDiscount] = useState<string | number>(
    isNewPeriod ? 0 : (row.discount ?? 0),
  );
  const [discountReason, setDiscountReason] = useState(
    isNewPeriod ? "" : (row.discount_reason ?? ""),
  );
  const [adjustmentReason, setAdjustmentReason] = useState(
    isNewPeriod ? "Tạo đợt học phí mới" : "",
  );
  const [requestId] = useState(() => (isNewPeriod ? crypto.randomUUID() : ""));
  const totalDue = Number(sessions) * Number(price) - Number(discount);
  const action = isNewPeriod
    ? startB2CTuitionPeriodAction
    : row.package_id
      ? saveB2CTuitionPeriodAction
      : saveB2CTuitionPackageAction;
  const { state, formAction } = useFormAction(action, { onSuccess });
  const key = row.package_id ?? row.enrollment_id;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="enrollment_id" value={row.enrollment_id} />
      {row.package_id && (
        <input
          type="hidden"
          name={isNewPeriod ? "previous_package_id" : "package_id"}
          value={row.package_id}
        />
      )}
      {isNewPeriod && (
        <input type="hidden" name="request_id" value={requestId} />
      )}
      <input type="hidden" name="expected_due" value={row.total_due ?? ""} />
      <input type="hidden" name="expected_paid" value={row.paid_amount} />
      {row.package_id && (
        <div className="space-y-2">
          <Label htmlFor={`adjustment-${key}`}>
            {isNewPeriod ? "Lý do tạo đợt mới *" : "Lý do điều chỉnh *"}
          </Label>
          <Input
            id={`adjustment-${key}`}
            name="adjustment_reason"
            required
            maxLength={1000}
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
        </div>
      )}
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
          onChange={(e) => setSessions(e.target.value)}
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
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`discount-${key}`}>Chiết khấu (VNĐ)</Label>
        <Input
          id={`discount-${key}`}
          name="discount"
          type="number"
          min={0}
          max={Number(sessions) * Number(price)}
          step={1}
          required
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`reason-${key}`}>
          Lý do chiết khấu{Number(discount) > 0 ? " *" : ""}
        </Label>
        <Input
          id={`reason-${key}`}
          name="discount_reason"
          required={Number(discount) > 0}
          maxLength={1000}
          value={discountReason}
          onChange={(e) => setDiscountReason(e.target.value)}
        />
      </div>
      <p className="font-semibold">
        Tổng phải thu:{" "}
        {sessions === "" || price === "" ? "—" : formatCurrency(totalDue)}
      </p>
      <p className="text-muted-foreground text-sm">
        {isNewPeriod
          ? `Đợt mới đã thu ${formatCurrency(0)}. Đợt ${row.period_no ?? 1} đã thu ${formatCurrency(row.paid_amount)}.`
          : `Đã thu ${formatCurrency(row.paid_amount)}.`}
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
        <SubmitButton>
          {isNewPeriod ? "Lưu đợt học phí mới" : "Lưu gói học phí"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function TuitionReceiptsDialog({
  row,
  collector,
  today,
  classId,
  canCollect = true,
}: {
  row: B2CTuitionRow;
  collector: string;
  today: string;
  classId?: string;
  canCollect?: boolean;
}) {
  const refresh = useClassWorkspaceRefresh();
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
      refresh();
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
  const key = row.package_id ?? row.enrollment_id;
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
            {row.full_name} · {row.class_name} · Đợt {row.period_no ?? 1} · Còn
            phải thu {formatCurrency(row.balance)}
          </DialogDescription>
        </DialogHeader>
        {canCollect && row.balance > 0 && (
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
                        <td className="py-2 pr-3">
                          {r.code}
                          {r.cancelled_at && (
                            <p className="text-destructive">Đã hủy</p>
                          )}
                          {r.correction_reason && (
                            <p className="text-xs">{r.correction_reason}</p>
                          )}
                        </td>
                        <td className="pr-3">
                          {r.paid_date.split("-").reverse().join("/")}
                        </td>
                        <td className="pr-3">
                          {formatCurrency(r.amount)}
                          {Number(r.refunded_amount) > 0 && (
                            <p className="text-xs">
                              Đã hoàn{" "}
                              {formatCurrency(Number(r.refunded_amount))}
                            </p>
                          )}
                          <p className="text-xs">
                            Thu ròng{" "}
                            {formatCurrency(
                              Number(r.effective_amount ?? r.amount),
                            )}
                          </p>
                        </td>
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
