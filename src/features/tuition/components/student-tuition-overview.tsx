import {
  BanknoteArrowUp,
  CircleAlert,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentStatCard } from "@/components/shared/student-stat-card";
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
  const paidPercent = toPercent(paid, total);

  return (
    <div className="space-y-6">
      <section aria-labelledby="m26-summary" className="space-y-4">
        <h2 id="m26-summary" className="text-base font-semibold">
          Tổng quan học phí
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StudentStatCard
            icon={ReceiptText}
            tone="sky"
            label="Tổng hóa đơn"
            value={formatCurrency(total)}
          />
          <StudentStatCard
            icon={BanknoteArrowUp}
            tone="cyan"
            label="Đã thanh toán"
            value={formatCurrency(paid)}
          />
          <StudentStatCard
            icon={Wallet}
            tone="amber"
            label="Còn phải đóng"
            value={formatCurrency(balance)}
          />
          <StudentStatCard
            icon={CircleAlert}
            tone={overdue > 0 ? "coral" : "sky"}
            label="Hóa đơn quá hạn"
            value={String(overdue)}
            // Không để màu là kênh duy nhất mang thông tin (WCAG 1.4.1):
            // số 0 được nói thành chữ thay vì chỉ đổi sang màu bình thường.
            hint={overdue > 0 ? "Cần xử lý sớm." : "Không có hóa đơn quá hạn."}
          />
        </div>

        {total > 0 && (
          <Card className="border-student-cyan-border bg-student-cyan-surface shadow-none">
            <CardContent className="px-5 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Tiến độ đóng học phí</p>
                <p className="text-student-cyan-ink text-xl font-bold tabular-nums">
                  {paidPercent}%
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Tiến độ đóng học phí"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={paidPercent}
                aria-valuetext={`Đã đóng ${formatCurrency(paid)} trên tổng ${formatCurrency(total)}`}
                className="bg-surface-sunken mt-3 h-2.5 overflow-hidden rounded-full"
              >
                <div
                  className="bg-student-cyan-ink h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
              <p className="text-text-secondary mt-2 text-sm leading-6">
                Đã đóng {formatCurrency(paid)} trên tổng{" "}
                {formatCurrency(total)}.
              </p>
            </CardContent>
          </Card>
        )}

        {overdue > 0 && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              Bạn có {overdue} hóa đơn đã quá hạn và còn số dư. Vui lòng liên hệ
              trung tâm nếu cần đối soát.
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section aria-labelledby="m26-invoices" className="space-y-4">
        <h2 id="m26-invoices" className="text-base font-semibold">
          Hóa đơn của bạn ({invoices.length})
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {invoices.map((invoice) => (
            <StudentInvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StudentInvoiceCard({ invoice }: { invoice: TuitionInvoiceRecord }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      {/*
        Bỏ icon `WalletCards` trang trí ở góc phải header: nó không mang thông
        tin nào, và ở 360px thì `flex-wrap` đẩy nó xuống một dòng riêng thành
        một icon lạc lõng dưới tên lớp.
      */}
      <CardHeader className="gap-3 border-b">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle asChild>
              <h3 className="font-mono text-base">{invoice.invoice_code}</h3>
            </CardTitle>
            <StatusBadge
              label={INVOICE_STATUS_LABELS[invoice.status]}
              tone={INVOICE_STATUS_TONE[invoice.status]}
            />
          </div>
          <p className="text-text-secondary mt-1 text-sm">
            {invoice.enrollment?.class
              ? `${invoice.enrollment.class.code} — ${invoice.enrollment.class.name}`
              : "Hóa đơn không gắn lớp"}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="text-text-secondary flex flex-wrap gap-x-5 gap-y-1 text-sm">
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
                className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-text-secondary mt-0.5 text-sm">
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

          {/*
            `subtotal` và `discount` vốn được truy vấn nhưng không hiển thị ở
            đâu — học viên được giảm trừ mà không thấy mình được giảm bao nhiêu.
            Chỉ hiện hai dòng này khi thật sự có giảm trừ, để hóa đơn thường
            không bị thêm nhiễu. Chữ lấy đúng như màn quản trị đang dùng
            (`invoice-manager.tsx:244-245`), không đặt từ mới.
          */}
          <dl className="bg-surface-sunken space-y-1.5 border-t px-3 py-3 text-sm">
            {invoice.discount > 0 && (
              <>
                <MoneyRow label="Tạm tính" value={invoice.subtotal} />
                <MoneyRow label="Giảm trừ" value={invoice.discount} />
              </>
            )}
            <MoneyRow label="Tổng hóa đơn" value={invoice.total} strong />
            <MoneyRow label="Đã thanh toán" value={invoice.paid_amount} />
            <MoneyRow label="Còn phải đóng" value={invoice.balance} strong />
          </dl>
        </div>

        {invoice.note && (
          <p className="text-text-secondary text-sm leading-6 whitespace-pre-wrap">
            {invoice.note}
          </p>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Thanh toán &amp; phiếu thu</h4>
          {invoice.tuition_payments.length === 0 ? (
            <p className="text-text-secondary rounded-lg border px-3 py-4 text-sm">
              Chưa có thanh toán được ghi nhận.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {invoice.tuition_payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">
                      {payment.tuition_receipts?.receipt_code ??
                        payment.payment_code}
                    </p>
                    <p className="text-text-secondary mt-1 text-sm leading-6">
                      {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                      {formatDateTime(payment.paid_at)}
                      {payment.reference
                        ? ` · Tham chiếu: ${payment.reference}`
                        : ""}
                    </p>
                    {payment.note && (
                      <p className="text-text-secondary mt-1 text-sm leading-6">
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

/** Tỉ lệ đã đóng, kẹp 0–100. Tổng bằng 0 thì coi như chưa có gì để đo. */
function toPercent(paid: number, total: number): number {
  if (!Number.isFinite(paid) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
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
      <dt className={strong ? "font-medium" : "text-text-secondary"}>
        {label}
      </dt>
      <dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
