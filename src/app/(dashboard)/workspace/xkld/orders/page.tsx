import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MarketDialog,
  OrderDialog,
} from "@/features/xkld/components/order-dialogs";
import {
  canEditXkld,
  XKLD_READ_ROLES,
} from "@/features/xkld/domain/candidates";
import {
  orderFiltersSchema,
  ORDER_STATUSES,
  ORDERS_PATH,
  recruitmentExpired,
  formatOrderSalary,
} from "@/features/xkld/domain/orders";
import { getOrders } from "@/features/xkld/server/orders";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thị trường & đơn hàng XKLĐ" };
type Params = Record<string, string | string[] | undefined>;
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(...XKLD_READ_ROLES);
  const params = await searchParams;
  const parsed = orderFiltersSchema.safeParse(
    Object.fromEntries(
      ["q", "market", "status", "deadline", "page"].map((key) => [
        key,
        typeof params[key] === "string" ? params[key] : undefined,
      ]),
    ),
  );
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Thị trường & đơn hàng" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={ORDERS_PATH}>Xóa bộ lọc</Link>
      </>
    );
  const filters = parsed.data;
  const { actor, rows, total, markets, today } = await getOrders(filters);
  const editable = canEditXkld(actor.role);
  const countries = new Map(markets.map((m) => [m.id, m]));
  const pages = Math.max(1, Math.ceil(total / 25));
  const pageHref = (page: number) =>
    `${ORDERS_PATH}?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return (
    <>
      <PageHeader
        title="Thị trường & đơn hàng"
        description="Quốc gia, chủ sử dụng, ngành nghề, chỉ tiêu tuyển, lương, điều kiện và đối tác."
      />
      <section
        aria-labelledby="markets-heading"
        className="bg-card mb-5 rounded-xl border p-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="markets-heading" className="font-semibold">
            Thị trường
          </h2>
          {editable && <MarketDialog />}
        </div>
        <div className="flex flex-wrap gap-3">
          {markets.map((m) => (
            <div
              key={m.id}
              className="bg-background flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {m.country_name}{" "}
                  <span className="text-muted-foreground">
                    ({m.country_code})
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {m.currency_code}
                  {!m.is_active ? " · Ngừng sử dụng" : ""}
                </p>
              </div>
              {editable && <MarketDialog market={m} />}
            </div>
          ))}
        </div>
        {!markets.length && (
          <p className="text-muted-foreground text-sm">
            Chưa có thị trường. Thêm thị trường trước khi tạo đơn hàng.
          </p>
        )}
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {total.toLocaleString("vi-VN")} đơn hàng
          {!editable ? " · Chế độ chỉ xem" : ""}
        </p>
        {editable && <OrderDialog markets={markets} />}
      </div>
      <form className="bg-card mb-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm">
          Tìm đơn hàng
          <Input
            name="q"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Mã, chủ sử dụng, nghề, đối tác…"
          />
        </label>
        {[
          {
            name: "market",
            label: "Quốc gia",
            value: filters.market,
            options: markets.map((m) => [m.id, m.country_name]),
          },
          {
            name: "status",
            label: "Trạng thái",
            value: filters.status,
            options: Object.entries(ORDER_STATUSES),
          },
          {
            name: "deadline",
            label: "Hạn tuyển",
            value: filters.deadline,
            options: [
              ["current", "Từ hôm nay trở đi"],
              ["expired", "Đã qua hạn"],
            ],
          },
        ].map((f) => (
          <label key={f.name} className="grid gap-1 text-sm">
            {f.label}
            <select
              name={f.name}
              defaultValue={f.value}
              className="border-input bg-background h-10 rounded-md border px-3"
            >
              <option value="">Tất cả</option>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="flex items-end gap-2">
          <Button type="submit">Lọc</Button>
          <Button asChild variant="outline">
            <Link href={ORDERS_PATH}>Xóa lọc</Link>
          </Button>
        </div>
      </form>
      <div
        className="bg-card overflow-x-auto rounded-xl border"
        role="region"
        aria-label="Danh sách đơn hàng, cuộn ngang để xem thêm"
        tabIndex={0}
      >
        <table className="w-full min-w-[80rem] text-left text-sm">
          <caption className="sr-only">
            Đơn hàng tuyển dụng xuất khẩu lao động
          </caption>
          <thead className="bg-muted/60">
            <tr>
              {[
                "Mã ĐH",
                "Quốc gia",
                "Chủ sử dụng",
                "Ngành nghề",
                "SL tuyển",
                "Lương",
                "Điều kiện",
                "Hạn tuyển",
                "Đối tác",
                "Trạng thái",
                ...(editable ? ["Thao tác"] : []),
              ].map((label) => (
                <th scope="col" key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3">
                  {countries.get(row.market_id)?.country_name ??
                    "Thị trường cũ"}
                </td>
                <td className="max-w-56 px-4 py-3 font-medium break-words">
                  {row.employer}
                </td>
                <td className="px-4 py-3">{row.industry}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.recruitment_quantity.toLocaleString("vi-VN")}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatOrderSalary(row)}
                </td>
                <td className="max-w-64 px-4 py-3">
                  <details>
                    <summary className="text-primary cursor-pointer">
                      Xem điều kiện
                    </summary>
                    <p className="mt-2 break-words whitespace-pre-wrap">
                      {row.conditions}
                    </p>
                  </details>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.recruitment_deadline.split("-").reverse().join("/")}
                  {recruitmentExpired(row, today) && (
                    <p className="text-xs text-amber-700">Đã qua hạn</p>
                  )}
                </td>
                <td className="max-w-48 px-4 py-3 break-words">
                  {row.partner}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs whitespace-nowrap ${row.status === "open" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                  >
                    {ORDER_STATUSES[row.status]}
                  </span>
                </td>
                {editable && (
                  <td className="px-4 py-3">
                    <OrderDialog order={row} markets={markets} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="text-muted-foreground p-8 text-center">
            {total
              ? "Trang này không có kết quả. Hãy về trang đầu."
              : "Chưa có đơn hàng phù hợp. Thêm đơn hàng mới hoặc thay đổi bộ lọc."}
          </p>
        )}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Lương giữ nguyên tiền tệ và kỳ lương đã nhập; không cộng gộp hoặc tự quy
        đổi.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          Trang {filters.page + 1} / {pages} · 25 đơn hàng/trang
        </p>
        <div className="flex gap-2">
          {filters.page > 0 && (
            <Button asChild variant="outline">
              <Link href={pageHref(filters.page - 1)}>Trang trước</Link>
            </Button>
          )}
          {filters.page + 1 < pages && (
            <Button asChild variant="outline">
              <Link href={pageHref(filters.page + 1)}>Trang sau</Link>
            </Button>
          )}
          {filters.page >= pages && (
            <Link href={pageHref(0)}>Về trang đầu</Link>
          )}
        </div>
      </div>
    </>
  );
}
