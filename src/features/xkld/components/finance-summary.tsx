import { moneyVnd, type FinanceTotals } from "../domain/finance";
export function FinanceSummary({
  totals,
  commission = false,
}: {
  totals: FinanceTotals;
  commission?: boolean;
}) {
  const values = [
    [commission ? "Hoa hồng phải chi" : "Phí phải thu hiện tại", totals.amount],
    [commission ? "Đã chi" : "Đã thu", totals.paid],
    ...(!commission
      ? [
          ["Đã hoàn", totals.refunded],
          ["Thực thu sau hoàn", totals.net_paid],
        ]
      : []),
    [commission ? "Còn phải chi" : "Còn nợ", totals.balance],
    ["Quá hạn", totals.overdue],
  ] as const;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-2 text-xl font-semibold">
            {moneyVnd(Number(value))}
          </p>
        </div>
      ))}
    </div>
  );
}
