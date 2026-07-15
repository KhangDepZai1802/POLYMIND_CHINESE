import { CircleAlert, ReceiptText, WalletCards } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TuitionInvoiceRecord } from "@/features/tuition/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/dates";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
} from "@/lib/domain/labels";

export function StudentTuitionOverview({
  invoices,
}: {
  invoices: TuitionInvoiceRecord[];
}) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={ReceiptText}
            title="Chưa có hóa đơn học phí"
            description="Hóa đơn sẽ xuất hiện ở đây sau khi trung tâm phát hành."
          />
        </CardContent>
      </Card>
    );
  }

  const total = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.paid_amount, 0);
  const balance = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdue = invoices.filter((invoice) => invoice.is_overdue).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Tổng hóa đơn" value={formatCurrency(total)} />
        <SummaryCard label="Đã thanh toán" value={formatCurrency(paid)} />
        <SummaryCard label="Còn phải đóng" value={formatCurrency(balance)} />
        <SummaryCard
          label="Hóa đơn quá hạn"
          value={String(overdue)}
          danger={overdue > 0}
        />
      </div>

      {overdue > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Bạn có {overdue} hóa đơn đã quá hạn và còn số dư. Vui lòng liên hệ
            trung tâm nếu cần đối soát.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {invoices.map((invoice) => (
          <StudentInvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p
          className={
            danger
              ? "text-destructive mt-1 text-2xl font-bold tabular-nums"
              : "mt-1 text-2xl font-bold tabular-nums"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StudentInvoiceCard({ invoice }: { invoice: TuitionInvoiceRecord }) {
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
            <p className="text-muted-foreground mt-1 text-xs">
              {invoice.enrollment?.class
                ? `${invoice.enrollment.class.code} — ${invoice.enrollment.class.name}`
                : "Hóa đơn không gắn lớp"}
            </p>
          </div>
          <WalletCards className="text-muted-foreground size-5" aria-hidden />
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
              Hóa đơn đã quá hạn và còn số dư phải đóng.
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
            <MoneyRow label="Tổng hóa đơn" value={invoice.total} strong />
            <MoneyRow label="Đã thanh toán" value={invoice.paid_amount} />
            <MoneyRow label="Còn phải đóng" value={invoice.balance} strong />
          </div>
        </div>

        {invoice.note && (
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
            {invoice.note}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Thanh toán & phiếu thu</h3>
          {invoice.tuition_payments.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border px-3 py-4 text-sm">
              Chưa có thanh toán được ghi nhận.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {invoice.tuition_payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-mono text-xs font-medium">
                      {payment.tuition_receipts?.receipt_code ??
                        payment.payment_code}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                      {formatDateTime(payment.paid_at)}
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
          )}
        </div>
      </CardContent>
    </Card>
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
