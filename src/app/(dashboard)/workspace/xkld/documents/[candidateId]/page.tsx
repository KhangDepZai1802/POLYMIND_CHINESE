import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
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
  documentStatus,
  type DocumentRow,
} from "@/features/xkld/domain/documents";
import { readDocumentsAction } from "@/features/xkld/server/document-actions";
import {
  DocumentDialog,
  DocumentFilesDialog,
} from "@/features/xkld/components/document-dialogs";
export const metadata = { title: "Hồ sơ giấy tờ ứng viên" };
export default async function CandidateDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{ market?: string; page?: string }>;
}) {
  const actor = await requireRole(...XKLD_READ_ROLES),
    { candidateId } = await params,
    filters = await searchParams;
  if (!z.uuid().safeParse(candidateId).success) notFound();
  const client = await createClient();
  const [candidate, markets] = await Promise.all([
    client
      .from("xkld_candidates")
      .select("id,code,full_name,order_id")
      .eq("id", candidateId)
      .maybeSingle(),
    client
      .from("xkld_markets")
      .select("id,country_name,is_active")
      .order("country_name"),
  ]);
  if (candidate.error || markets.error)
    throw new Error("Không tải được hồ sơ.");
  if (!candidate.data) notFound();
  const order = candidate.data.order_id
    ? await client
        .from("xkld_orders")
        .select("market_id")
        .eq("id", candidate.data.order_id)
        .maybeSingle()
    : null;
  const market = markets.data.find(
    (m) => m.id === (filters.market ?? order?.data?.market_id),
  );
  const page = /^\d{1,6}$/.test(filters.page ?? "") ? Number(filters.page) : 0;
  const rows = market
    ? ((await readDocumentsAction("documents", {
        candidate_id: candidateId,
        market_id: market.id,
        page,
      })) as unknown as DocumentRow[])
    : [];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const canEdit = canEditXkld(actor.role);
  return (
    <>
      <PageHeader
        title={`Hồ sơ: ${candidate.data.full_name}`}
        description={`${candidate.data.code} · ${canEdit ? "Cập nhật giấy tờ và tệp đính kèm" : "Chế độ chỉ xem"}`}
      />
      <Link
        href={DOCUMENTS_PATH}
        className="text-primary mb-4 inline-block underline"
      >
        ← Danh sách ứng viên
      </Link>
      <form className="mb-5 flex flex-wrap gap-3">
        <select
          name="market"
          aria-label="Thị trường"
          defaultValue={market?.id ?? ""}
          className="bg-background max-w-full rounded border p-2"
        >
          <option value="">Chọn thị trường</option>
          {markets.data.map((m) => (
            <option key={m.id} value={m.id}>
              {m.country_name}
              {!m.is_active ? " (ngừng sử dụng)" : ""}
            </option>
          ))}
        </select>
        <Button>Chọn</Button>
        <Button asChild variant="outline">
          <Link
            href={`${DOCUMENTS_PATH}/checklists${market ? `?market=${market.id}` : ""}`}
          >
            Xem checklist
          </Link>
        </Button>
      </form>
      <p className="text-muted-foreground mb-4 text-sm">
        Cảnh báo sắp hết hạn trong 30 ngày. Tệp đính kèm không tự xác nhận hồ sơ
        hợp lệ; hồ sơ thị trường cũ vẫn được giữ lại.
      </p>
      {market && (
        <div className="mb-4 flex gap-4 text-sm">
          <span>Trang {page + 1} · 25 giấy tờ/trang</span>
          {page > 0 && (
            <Link href={`?market=${market.id}&page=${page - 1}`}>
              Trang trước
            </Link>
          )}
          {rows.length === 25 && (
            <Link href={`?market=${market.id}&page=${page + 1}`}>
              Trang sau
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-4">
        {rows.map((row) => {
          const status = documentStatus(row, today);
          return (
            <section
              key={row.requirement.id}
              className="bg-card rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {row.requirement.name}{" "}
                    {row.requirement.is_required && (
                      <span className="text-destructive">*</span>
                    )}
                  </h2>
                  <p
                    className={`mt-1 text-sm ${status.includes("hạn") ? "text-orange-700" : "text-muted-foreground"}`}
                  >
                    {status}
                    {!row.requirement.is_active
                      ? " · Checklist ngừng sử dụng"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <DocumentDialog candidateId={candidateId} row={row} />
                  )}
                  <DocumentFilesDialog
                    candidateId={candidateId}
                    row={row}
                    canEdit={canEdit}
                  />
                </div>
              </div>
              <p className="mt-3 text-sm">
                Ngày nộp:{" "}
                {row.document?.submitted_on?.split("-").reverse().join("/") ??
                  "—"}{" "}
                · Hết hạn:{" "}
                {row.document?.expires_on?.split("-").reverse().join("/") ??
                  "—"}
              </p>
              {row.document?.note && (
                <p className="text-muted-foreground mt-2 text-sm break-words whitespace-pre-wrap">
                  {row.document.note}
                </p>
              )}
            </section>
          );
        })}
        {market && !rows.length && (
          <p>
            Chưa có checklist cho thị trường này. Cấu hình danh mục trước khi
            nhập hồ sơ.
          </p>
        )}
        {!market && <p>Chọn thị trường để xem checklist giấy tờ.</p>}
      </div>
    </>
  );
}
