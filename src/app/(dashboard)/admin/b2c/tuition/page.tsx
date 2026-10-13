import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  TuitionPackageDialog,
  TuitionReceiptsDialog,
} from "@/features/b2c/components/tuition-dialogs";
import type { B2CTuitionRow } from "@/features/b2c/tuition-schema";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, todayISO } from "@/lib/dates";
export const metadata: Metadata = { title: "Học phí" };
export default async function B2CTuitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireManager();
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const n = typeof params.page === "string" ? Number(params.page) : 0;
  const page = Number.isSafeInteger(n) && n >= 0 && n <= 1000000 ? n : 0;
  const { data, error } = await (
    await createClient()
  ).rpc("get_b2c_tuition_page", { p_query: query, p_page: page });
  if (error) throw new Error("Không tải được học phí B2C.");
  const result = data as unknown as {
    rows: B2CTuitionRow[];
    total: number;
    total_due: number;
    paid_amount: number;
  };
  const href = (next: number) =>
    `/admin/b2c/tuition?${new URLSearchParams({ q: query, page: String(next) })}`;
  return (
    <>
      <PageHeader
        title="Học phí – công nợ"
        description="Gói học phí theo ghi danh và phiếu thu nhiều đợt."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ["Tổng phải thu", result.total_due],
          ["Đã thu", result.paid_amount],
          ["Còn phải thu", result.total_due - result.paid_amount],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="pt-5">
              <dl>
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {formatCurrency(Number(value))}
                </dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={query}
          maxLength={200}
          aria-label="Tìm học phí"
          placeholder="Tên, mã học viên hoặc lớp…"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Tìm kiếm
        </Button>
        <span className="text-muted-foreground text-sm">
          {result.total} ghi danh · Tổng tiền theo kết quả tìm kiếm
        </span>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Học viên",
                "Lớp",
                "Số buổi",
                "Đơn giá",
                "Chiết khấu",
                "Phải thu",
                "Đã thu",
                "Còn nợ",
                "Thao tác",
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length ? (
              result.rows.map((row) => (
                <tr key={row.enrollment_id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.student_code}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.class_name}</td>
                  <td className="px-4 py-3">{row.sessions ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.unit_price === null
                      ? "—"
                      : formatCurrency(row.unit_price)}
                  </td>
                  <td className="px-4 py-3">
                    {row.discount === null ? "—" : formatCurrency(row.discount)}
                    {row.discount_reason && (
                      <p className="text-muted-foreground text-xs">
                        {row.discount_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.total_due === null
                      ? "Chưa có gói"
                      : formatCurrency(row.total_due)}
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(row.paid_amount)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {row.package_id ? formatCurrency(row.balance) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <TuitionPackageDialog row={row} />
                      <TuitionReceiptsDialog
                        row={row}
                        collector={actor.fullName}
                        today={todayISO()}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="text-muted-foreground py-10 text-center"
                >
                  Chưa có ghi danh phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        {page > 0 ? <Link href={href(page - 1)}>← Trước</Link> : <span />}
        <span>
          Trang {page + 1}/{Math.max(1, Math.ceil(result.total / 50))}
        </span>
        {(page + 1) * 50 < result.total ? (
          <Link href={href(page + 1)}>Sau →</Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
