import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  XKLD_READ_ROLES,
  canEditXkld,
} from "@/features/xkld/domain/candidates";
import {
  DOCUMENTS_PATH,
  type Requirement,
} from "@/features/xkld/domain/documents";
import { readDocumentsAction } from "@/features/xkld/server/document-actions";
import { RequirementDialog } from "@/features/xkld/components/document-dialogs";
export const metadata = { title: "Checklist giấy tờ theo thị trường" };
export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; page?: string }>;
}) {
  const actor = await requireRole(...XKLD_READ_ROLES),
    params = await searchParams;
  const { data: markets, error } = await (
    await createClient()
  )
    .from("xkld_markets")
    .select("id,country_name,is_active")
    .order("country_name");
  if (error) throw new Error("Không tải được thị trường.");
  const market = markets.find((m) => m.id === params.market);
  const page = /^\d{1,6}$/.test(params.page ?? "") ? Number(params.page) : 0;
  const rows = market
    ? ((await readDocumentsAction("checklists", {
        market_id: market.id,
        page,
      })) as unknown as Requirement[])
    : [];
  return (
    <>
      <PageHeader
        title="Checklist theo thị trường"
        description="Cấu hình danh mục giấy tờ thực tế. Ngừng sử dụng giữ nguyên hồ sơ cũ."
      />
      <form className="mb-5 flex flex-wrap gap-3">
        <select
          name="market"
          aria-label="Thị trường"
          defaultValue={market?.id ?? ""}
          className="bg-background rounded border p-2"
        >
          <option value="">Chọn thị trường</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.country_name}
              {!m.is_active ? " (ngừng sử dụng)" : ""}
            </option>
          ))}
        </select>
        <Button>Chọn</Button>
      </form>
      {market && (
        <>
          {canEditXkld(actor.role) && market.is_active && (
            <div className="mb-4">
              <RequirementDialog marketId={market.id} />
            </div>
          )}
          <div className="grid gap-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <strong>{r.name}</strong>
                  <p className="text-muted-foreground text-sm">
                    {r.is_required ? "Bắt buộc" : "Tùy chọn"} ·{" "}
                    {r.expects_expiry
                      ? "Có ngày hết hạn"
                      : "Không yêu cầu ngày hết hạn"}{" "}
                    · {r.is_active ? "Đang sử dụng" : "Ngừng sử dụng"}
                  </p>
                </div>
                {canEditXkld(actor.role) && (
                  <RequirementDialog marketId={market.id} requirement={r} />
                )}
              </div>
            ))}
            {!rows.length && <p>Chưa cấu hình checklist cho thị trường này.</p>}
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <span>Trang {page + 1} · 25 giấy tờ/trang</span>
            {page > 0 && (
              <Link
                href={`${DOCUMENTS_PATH}/checklists?market=${market.id}&page=${page - 1}`}
              >
                Trang trước
              </Link>
            )}
            {rows.length === 25 && (
              <Link
                href={`${DOCUMENTS_PATH}/checklists?market=${market.id}&page=${page + 1}`}
              >
                Trang sau
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
