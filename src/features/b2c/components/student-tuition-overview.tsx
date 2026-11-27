import {
  BanknoteArrowUp,
  CalendarClock,
  CircleCheck,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StudentStatCard } from "@/components/shared/student-stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  B2CStudentTuitionPage,
  B2CStudentTuitionPeriod,
} from "@/features/b2c/domain/student-tuition";
import { formatCurrency, formatDate } from "@/lib/dates";

export function B2CStudentTuitionOverview({
  page,
}: {
  page: B2CStudentTuitionPage;
}) {
  const configured = page.periods.filter((period) => period.package_id);
  const total = configured.reduce(
    (sum, period) => sum + Number(period.total_due ?? 0),
    0,
  );
  const paid = configured.reduce(
    (sum, period) => sum + Number(period.paid_amount),
    0,
  );
  const balance = configured.reduce(
    (sum, period) => sum + Number(period.balance ?? 0),
    0,
  );
  const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  if (page.periods.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={ReceiptText}
            title="Chưa có thông tin học phí"
            description="Thông tin sẽ xuất hiện sau khi trung tâm ghi danh và lập học phí cho bạn."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="b2c-tuition-summary" className="space-y-4">
        <h2 id="b2c-tuition-summary" className="text-base font-semibold">
          Tổng quan học phí lớp trung tâm
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StudentStatCard
            icon={ReceiptText}
            tone="sky"
            label="Phải thu"
            value={formatCurrency(total)}
          />
          <StudentStatCard
            icon={BanknoteArrowUp}
            tone="cyan"
            label="Đã thu"
            value={formatCurrency(paid)}
          />
          <StudentStatCard
            icon={Wallet}
            tone={balance > 0 ? "coral" : "amber"}
            label="Còn nợ"
            value={formatCurrency(balance)}
          />
          <StudentStatCard
            icon={balance > 0 ? CalendarClock : CircleCheck}
            tone={balance > 0 ? "coral" : "sky"}
            label="Trạng thái"
            value={balance > 0 ? "Chưa hoàn tất" : "Đã thanh toán đủ"}
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
                aria-label="Tiến độ đóng học phí lớp trung tâm"
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
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="b2c-tuition-periods" className="space-y-4">
        <h2 id="b2c-tuition-periods" className="text-base font-semibold">
          Học phí theo lớp và từng đợt
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {page.periods.map((period) => (
            <B2CTuitionPeriodCard
              key={period.package_id ?? period.enrollment_id}
              period={period}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function B2CTuitionPeriodCard({ period }: { period: B2CStudentTuitionPeriod }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="bg-student-sky-surface gap-2 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-student-sky-ink text-sm font-semibold">
              {period.class_code}
            </p>
            <CardTitle asChild>
              <h3 className="mt-1 text-lg break-words">{period.class_name}</h3>
            </CardTitle>
          </div>
          {period.package_id && (
            <span className="bg-background rounded-full border px-3 py-1 text-sm font-medium">
              Đợt {period.period_no ?? 1} · {period.is_current ? "Hiện tại" : "Đợt trước"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {!period.package_id ? (
          <p className="text-text-secondary text-sm">
            Trung tâm chưa lập gói học phí cho lớp này.
          </p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <TuitionField label="Số buổi" value={`${period.sessions ?? 0} buổi`} />
              <TuitionField
                label="Đơn giá"
                value={formatCurrency(period.unit_price ?? 0)}
              />
              <TuitionField
                label="Giảm trừ"
                value={formatCurrency(period.discount ?? 0)}
              />
              <TuitionField
                label="Phải thu"
                value={formatCurrency(period.total_due ?? 0)}
                strong
              />
              <TuitionField
                label="Đã thu"
                value={formatCurrency(period.paid_amount)}
              />
              <TuitionField
                label="Còn nợ"
                value={formatCurrency(period.balance ?? 0)}
                strong
              />
            </dl>

            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-semibold">
                Phiếu thu ({period.receipts.length})
              </h4>
              {period.receipts.length === 0 ? (
                <p className="text-text-secondary text-sm">
                  Chưa có phiếu thu.
                </p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {period.receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-medium">{receipt.code}</p>
                        <p className="text-text-secondary mt-1 leading-6">
                          {formatDate(receipt.paid_date)} · {receipt.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                        </p>
                        {receipt.cancelled_at && (
                          <p className="text-destructive mt-1">Phiếu đã hủy</p>
                        )}
                        {!receipt.cancelled_at && receipt.refunded_amount > 0 && (
                          <p className="text-text-secondary mt-1">
                            Đã hoàn {formatCurrency(receipt.refunded_amount)}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(receipt.effective_amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TuitionField({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-text-secondary text-sm font-medium">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>
        {value}
      </dd>
    </div>
  );
}
