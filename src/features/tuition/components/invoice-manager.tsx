"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CircleAlert,
  FileCheck2,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteTuitionInvoiceDraftAction,
  issueTuitionInvoiceAction,
  recordTuitionPaymentAction,
  saveTuitionInvoiceAction,
} from "@/features/tuition/server/actions";
import type {
  TuitionInvoiceRecord,
  TuitionStudentOption,
} from "@/features/tuition/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  toDateTimeInputValue,
} from "@/lib/dates";
import {
  ENROLLMENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
} from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";

type EditableItem = {
  key: string;
  description: string;
  quantity: string;
  unit_amount: string;
};

function newItem(): EditableItem {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit_amount: "",
  };
}

function invoiceItems(invoice?: TuitionInvoiceRecord): EditableItem[] {
  if (!invoice) return [newItem()];
  return invoice.tuition_invoice_items.map((item) => ({
    key: item.id,
    description: item.description,
    quantity: String(item.quantity),
    unit_amount: String(item.unit_amount),
  }));
}

function numericValue(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

export function TuitionInvoiceManager({
  invoices,
  students,
  defaultIssueDate,
}: {
  invoices: TuitionInvoiceRecord[];
  students: TuitionStudentOption[];
  defaultIssueDate: string;
}) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={ReceiptText}
            title="Chưa có hóa đơn"
            description="Tạo hóa đơn nháp, kiểm tra khoản mục và tổng tiền rồi mới phát hành cho học viên."
            action={
              <InvoiceDialog
                students={students}
                defaultIssueDate={defaultIssueDate}
              />
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InvoiceDialog
          students={students}
          defaultIssueDate={defaultIssueDate}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            students={students}
            defaultIssueDate={defaultIssueDate}
          />
        ))}
      </div>
    </div>
  );
}

function InvoiceCard({
  invoice,
  students,
  defaultIssueDate,
}: {
  invoice: TuitionInvoiceRecord;
  students: TuitionStudentOption[];
  defaultIssueDate: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-mono text-base">
                {invoice.invoice_code}
              </CardTitle>
              <StatusBadge
                label={INVOICE_STATUS_LABELS[invoice.status]}
                tone={INVOICE_STATUS_TONE[invoice.status]}
              />
            </div>
            <p className="mt-1 font-medium">
              {invoice.student?.full_name ?? "Học viên không xác định"}
            </p>
            <p className="text-muted-foreground text-xs">
              {invoice.student?.student_code ?? "—"}
              {invoice.enrollment?.class
                ? ` · ${invoice.enrollment.class.code} — ${invoice.enrollment.class.name}`
                : " · Không gắn ghi danh"}
            </p>
          </div>

          {invoice.status === "draft" ? (
            <div className="flex items-center gap-1">
              <InvoiceDialog
                students={students}
                defaultIssueDate={defaultIssueDate}
                invoice={invoice}
              />
              <IssueInvoiceButton invoice={invoice} />
              <DeleteDraftButton invoice={invoice} />
            </div>
          ) : invoice.balance > 0 &&
            ["issued", "partial", "overdue"].includes(invoice.status) ? (
            <PaymentDialog invoice={invoice} />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>Ngày lập: {formatDate(invoice.issue_date)}</span>
          <span>Hạn đóng: {formatDate(invoice.due_date)}</span>
        </div>

        {invoice.is_overdue && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              Hóa đơn đã quá hạn và còn số dư phải thu.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          <div className="divide-y">
            {invoice.tuition_invoice_items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Intl.NumberFormat("vi-VN", {
                      maximumFractionDigits: 2,
                    }).format(item.quantity)}{" "}
                    × {formatCurrency(item.unit_amount)}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatCurrency(item.line_total)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 space-y-1 border-t px-3 py-3 text-sm">
            <MoneyRow label="Tạm tính" value={invoice.subtotal} />
            <MoneyRow label="Giảm trừ" value={invoice.discount} />
            <MoneyRow label="Tổng hóa đơn" value={invoice.total} strong />
            {invoice.status !== "draft" && (
              <>
                <MoneyRow label="Đã thanh toán" value={invoice.paid_amount} />
                <MoneyRow
                  label="Còn phải đóng"
                  value={invoice.balance}
                  strong
                />
              </>
            )}
          </div>
        </div>

        {invoice.note && (
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
            {invoice.note}
          </p>
        )}

        {invoice.tuition_payments.length > 0 && (
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">Thanh toán & phiếu thu</h3>
              <p className="text-muted-foreground text-xs">
                Mỗi lần thu sinh đúng một phiếu thu trong cùng transaction.
              </p>
            </div>
            <div className="divide-y rounded-lg border">
              {invoice.tuition_payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-medium">
                        {payment.payment_code}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                        {formatDateTime(payment.paid_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Phiếu thu:{" "}
                      <span className="font-mono">
                        {payment.tuition_receipts?.receipt_code ??
                          "Chưa sinh phiếu — cần kiểm tra"}
                      </span>
                      {payment.reference
                        ? ` · Tham chiếu: ${payment.reference}`
                        : ""}
                    </p>
                    {payment.note && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {payment.note}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentDialog({ invoice }: { invoice: TuitionInvoiceRecord }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(recordTuitionPaymentAction, {
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Banknote aria-hidden />
          Ghi nhận thu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
          <DialogDescription>
            {invoice.invoice_code} · {invoice.student?.full_name ?? "Học viên"}{" "}
            · còn {formatCurrency(invoice.balance)}. Phiếu thu được sinh tự
            động.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="invoice_id" value={invoice.id} />

          {state.error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`payment-amount-${invoice.id}`}>Số tiền *</Label>
            <Input
              id={`payment-amount-${invoice.id}`}
              name="amount"
              type="number"
              min="0.01"
              max={invoice.balance}
              step="0.01"
              required
              defaultValue={invoice.balance}
            />
            <FieldError message={state.fieldErrors?.amount} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phương thức *</Label>
              <Select name="method" defaultValue="bank_transfer" required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <FieldError message={state.fieldErrors?.method} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`payment-at-${invoice.id}`}>Thời điểm *</Label>
              <DateTimePicker
                id={`payment-at-${invoice.id}`}
                name="paid_at"
                defaultValue={toDateTimeInputValue(new Date())}
                placeholder="Chọn thời điểm"
              />
              <FieldError message={state.fieldErrors?.paid_at} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`payment-reference-${invoice.id}`}>
              Mã tham chiếu
            </Label>
            <Input
              id={`payment-reference-${invoice.id}`}
              name="reference"
              maxLength={300}
              placeholder="VD: mã giao dịch ngân hàng"
            />
            <FieldError message={state.fieldErrors?.reference} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`payment-note-${invoice.id}`}>Ghi chú</Label>
            <Textarea
              id={`payment-note-${invoice.id}`}
              name="note"
              rows={3}
              placeholder="Thông tin nội bộ về lần thu"
            />
            <FieldError message={state.fieldErrors?.note} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton pendingText="Đang ghi nhận…">
              Xác nhận thanh toán
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function InvoiceDialog({
  students,
  defaultIssueDate,
  invoice,
}: {
  students: TuitionStudentOption[];
  defaultIssueDate: string;
  invoice?: TuitionInvoiceRecord;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(invoice?.student_id ?? "");
  const [enrollmentId, setEnrollmentId] = useState(
    invoice?.enrollment_id ?? "none",
  );
  const [items, setItems] = useState<EditableItem[]>(() =>
    invoiceItems(invoice),
  );
  const [discount, setDiscount] = useState(String(invoice?.discount ?? 0));
  const { state, formAction } = useFormAction(saveTuitionInvoiceAction, {
    onSuccess: () => setOpen(false),
  });

  const enrollments = useMemo(
    () =>
      students.find((student) => student.id === studentId)?.enrollments ?? [],
    [studentId, students],
  );
  const subtotal = items.reduce(
    (sum, item) =>
      sum + numericValue(item.quantity) * numericValue(item.unit_amount),
    0,
  );
  const total = Math.max(0, subtotal - numericValue(discount));

  function resetFields() {
    setStudentId(invoice?.student_id ?? "");
    setEnrollmentId(invoice?.enrollment_id ?? "none");
    setItems(invoiceItems(invoice));
    setDiscount(String(invoice?.discount ?? 0));
  }

  function setItem(index: number, field: keyof EditableItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) resetFields();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={invoice ? "ghost" : "default"}
          size={invoice ? "icon" : "default"}
        >
          {invoice ? (
            <>
              <Pencil aria-hidden />
              <span className="sr-only">
                Sửa hóa đơn {invoice.invoice_code}
              </span>
            </>
          ) : (
            <>
              <Plus aria-hidden />
              Tạo hóa đơn
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? `Sửa ${invoice.invoice_code}` : "Tạo hóa đơn học phí"}
          </DialogTitle>
          <DialogDescription>
            Tổng tiền được database tính từ khoản mục. Hóa đơn đã phát hành sẽ
            khóa chỉnh sửa để giữ lịch sử.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="invoice_id" value={invoice?.id ?? ""} />
          <input
            type="hidden"
            name="items_json"
            value={JSON.stringify(
              items.map((item) => ({
                description: item.description,
                quantity: numericValue(item.quantity),
                unit_amount: numericValue(item.unit_amount),
              })),
            )}
          />

          {state.error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Học viên *</Label>
              <Select
                name="student_id"
                value={studentId}
                onValueChange={(value) => {
                  setStudentId(value);
                  setEnrollmentId("none");
                }}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn học viên" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.student_code} — {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={state.fieldErrors?.student_id} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Ghi danh / lớp liên quan</Label>
              <Select
                name="enrollment_id"
                value={enrollmentId}
                onValueChange={setEnrollmentId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Không gắn ghi danh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn ghi danh</SelectItem>
                  {enrollments.map((enrollment) => (
                    <SelectItem key={enrollment.id} value={enrollment.id}>
                      {enrollment.class?.code ?? "Lớp không xác định"} —{" "}
                      {enrollment.class?.name ?? "—"} ·{" "}
                      {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Lớp được DB suy ra từ ghi danh, không nhận từ client.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`issue-date-${invoice?.id ?? "new"}`}>
                Ngày lập *
              </Label>
              <DatePicker
                id={`issue-date-${invoice?.id ?? "new"}`}
                name="issue_date"
                defaultValue={invoice?.issue_date ?? defaultIssueDate}
                placeholder="Chọn ngày"
              />
              <FieldError message={state.fieldErrors?.issue_date} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`due-date-${invoice?.id ?? "new"}`}>
                Hạn thanh toán
              </Label>
              <DatePicker
                id={`due-date-${invoice?.id ?? "new"}`}
                name="due_date"
                defaultValue={invoice?.due_date ?? ""}
                placeholder="Chọn ngày"
              />
              <FieldError message={state.fieldErrors?.due_date} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Khoản mục *</p>
                <p className="text-muted-foreground text-xs">
                  Tối đa 50 dòng; thành tiền từng dòng do DB tính.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, newItem()])}
                disabled={items.length >= 50}
              >
                <Plus aria-hidden />
                Thêm dòng
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]"
                >
                  <Input
                    aria-label={`Nội dung khoản mục ${index + 1}`}
                    placeholder="VD: Học phí khóa HSK 1"
                    value={item.description}
                    onChange={(event) =>
                      setItem(index, "description", event.target.value)
                    }
                  />
                  <Input
                    aria-label={`Số lượng khoản mục ${index + 1}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Số lượng"
                    value={item.quantity}
                    onChange={(event) =>
                      setItem(index, "quantity", event.target.value)
                    }
                  />
                  <Input
                    aria-label={`Đơn giá khoản mục ${index + 1}`}
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Đơn giá"
                    value={item.unit_amount}
                    onChange={(event) =>
                      setItem(index, "unit_amount", event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={`Xóa khoản mục ${index + 1}`}
                  >
                    <Trash2 className="text-destructive" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <FieldError message={state.fieldErrors?.items} />
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`invoice-note-${invoice?.id ?? "new"}`}>
                Ghi chú
              </Label>
              <Textarea
                id={`invoice-note-${invoice?.id ?? "new"}`}
                name="note"
                rows={3}
                defaultValue={invoice?.note ?? ""}
                placeholder="Nội dung hiển thị cùng hóa đơn"
              />
            </div>

            <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
              <MoneyRow label="Tạm tính" value={subtotal} />
              <div className="space-y-1">
                <Label htmlFor={`discount-${invoice?.id ?? "new"}`}>
                  Giảm trừ
                </Label>
                <Input
                  id={`discount-${invoice?.id ?? "new"}`}
                  name="discount"
                  type="number"
                  min="0"
                  step="1000"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
                <FieldError message={state.fieldErrors?.discount} />
              </div>
              <MoneyRow label="Tổng hóa đơn" value={total} strong />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton pendingText="Đang lưu…">
              {invoice ? "Lưu thay đổi" : "Tạo bản nháp"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueInvoiceButton({ invoice }: { invoice: TuitionInvoiceRecord }) {
  const { formAction } = useFormAction(issueTuitionInvoiceAction, {
    toastError: true,
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Phát hành ${invoice.invoice_code}? Sau bước này hóa đơn sẽ khóa chỉnh sửa.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="invoice_id" value={invoice.id} />
      <SubmitButton
        size="icon"
        variant="ghost"
        pendingText=""
        aria-label={`Phát hành ${invoice.invoice_code}`}
      >
        <FileCheck2 className="text-primary" aria-hidden />
        <span className="sr-only">Phát hành {invoice.invoice_code}</span>
      </SubmitButton>
    </form>
  );
}

function DeleteDraftButton({ invoice }: { invoice: TuitionInvoiceRecord }) {
  const { formAction } = useFormAction(deleteTuitionInvoiceDraftAction, {
    toastError: true,
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Xóa bản nháp ${invoice.invoice_code}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="invoice_id" value={invoice.id} />
      <SubmitButton
        size="icon"
        variant="ghost"
        pendingText=""
        aria-label={`Xóa ${invoice.invoice_code}`}
      >
        <Trash2 className="text-destructive" aria-hidden />
        <span className="sr-only">Xóa {invoice.invoice_code}</span>
      </SubmitButton>
    </form>
  );
}
