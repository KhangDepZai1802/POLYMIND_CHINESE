import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import { XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import {
  FINANCE_PATH,
  FINANCE_KINDS,
  canManageFinance,
  financeFiltersSchema,
  moneyVnd,
  type FinanceOverview,
} from "@/features/xkld/domain/finance";
import { readFinanceAction } from "@/features/xkld/server/finance-actions";
import { FinanceSummary } from "@/features/xkld/components/finance-summary";
export const metadata = { title: "Tài chính XKLĐ" };
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole(...XKLD_READ_ROLES),
    params = await searchParams,
    full = canManageFinance(actor.role);
  const parsed = financeFiltersSchema.safeParse({
    q: params.q,
    page: params.page,
    kind: full ? params.kind : "candidate_fee",
  });
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Tài chính XKLĐ" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={FINANCE_PATH}>Xóa bộ lọc</Link>
      </>
    );
  const filters = parsed.data,
    result = (await readFinanceAction(
      "overview",
      filters,
    )) as unknown as FinanceOverview,
    commission = filters.kind === "commission";
  function href(page: number) {
    return `${FINANCE_PATH}?${new URLSearchParams({ q: filters.q, kind: filters.kind, page: String(page) })}`;
  }
  return (
    <>
      <PageHeader
        title={full ? "Tài chính XKLĐ" : "Công nợ ứng viên XKLĐ"}
        description={
          full
            ? "Quản lý phí từng đợt, thu/hoàn tiền, hoa hồng CTV và phí đối tác. Chỉ VNĐ."
            : "Chỉ xem công nợ ứng viên; không có quyền ghi phiếu hoặc xem hoa hồng/tài chính đối tác."
        }
      />
      <form className="mb-5 flex flex-wrap gap-3">
        <Input
          name="q"
          defaultValue={filters.q}
          maxLength={200}
          placeholder="Tìm mã, tên hoặc SĐT ứng viên…"
          aria-label="Tìm ứng viên"
          className="sm:max-w-sm"
        />
        {full && (
          <select
            name="kind"
            aria-label="Nhóm tài chính"
            defaultValue={filters.kind}
            className="bg-background max-w-full rounded border p-2"
          >
            {Object.entries(FINANCE_KINDS).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        <Button>Lọc</Button>
      </form>
      <h2 className="mb-3 font-semibold">{FINANCE_KINDS[filters.kind]}</h2>
      <FinanceSummary totals={result.totals} commission={commission} />
      <p className="text-muted-foreground mb-4 text-sm">
        Tổng theo toàn bộ ứng viên khớp bộ lọc. Khoản phải thu và thực thu được
        theo dõi riêng, chưa phải doanh thu kế toán hay lợi nhuận.
      </p>
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                "Ứng viên",
                commission ? "Phải chi" : "Phải thu hiện tại",
                commission ? "Đã chi" : "Thực thu sau hoàn",
                commission ? "Còn phải chi" : "Còn nợ",
                "Quá hạn",
                "Chi tiết",
              ].map((l) => (
                <th scope="col" key={l} className="p-3">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <strong>{c.full_name}</strong>
                  <p className="text-muted-foreground">{c.code}</p>
                </td>
                <td className="p-3">{moneyVnd(c.amount)}</td>
                <td className="p-3">{moneyVnd(c.net_paid)}</td>
                <td className="p-3 font-semibold">{moneyVnd(c.balance)}</td>
                <td className="p-3 text-orange-700">{moneyVnd(c.overdue)}</td>
                <td className="p-3">
                  <Link
                    href={`${FINANCE_PATH}/${c.id}?kind=${filters.kind}`}
                    className="text-primary underline"
                  >
                    Mở tài chính
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.rows.length && (
          <p className="p-6">Không có ứng viên phù hợp.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
        <p>
          {result.total} ứng viên · Trang {filters.page + 1}
        </p>
        <div className="flex gap-3">
          {filters.page > 0 && (
            <Link href={href(filters.page - 1)}>Trang trước</Link>
          )}
          {(filters.page + 1) * 25 < result.total && (
            <Link href={href(filters.page + 1)}>Trang sau</Link>
          )}
        </div>
      </div>
    </>
  );
}
