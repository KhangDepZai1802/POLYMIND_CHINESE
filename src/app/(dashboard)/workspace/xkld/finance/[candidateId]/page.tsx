import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import {
  FINANCE_PATH,
  FINANCE_KINDS,
  canManageFinance,
  financeFiltersSchema,
  moneyVnd,
  type FinanceDetail,
} from "@/features/xkld/domain/finance";
import { readFinanceAction } from "@/features/xkld/server/finance-actions";
import { FinanceSummary } from "@/features/xkld/components/finance-summary";
import {
  InstallmentDialog,
  TransactionDialog,
  TransactionsDialog,
  FinanceHistoryDialog,
} from "@/features/xkld/components/finance-dialogs";
export const metadata = { title: "Tài chính ứng viên XKLĐ" };
export default async function CandidateFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const actor = await requireRole(...XKLD_READ_ROLES),
    { candidateId } = await params,
    query = await searchParams,
    full = canManageFinance(actor.role);
  if (!z.uuid().safeParse(candidateId).success) notFound();
  const parsed = financeFiltersSchema.safeParse({
    page: query.page,
    kind: full ? query.kind : "candidate_fee",
  });
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Tài chính ứng viên" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={`${FINANCE_PATH}/${candidateId}`}>Xóa bộ lọc</Link>
      </>
    );
  const filters = parsed.data,
    result = (await readFinanceAction("detail", {
      candidate_id: candidateId,
      kind: filters.kind,
      page: filters.page,
    })) as unknown as FinanceDetail;
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    commission = filters.kind === "commission";
  return (
    <>
      <PageHeader
        title={`${full ? "Tài chính" : "Công nợ"}: ${result.candidate.full_name}`}
        description={`${result.candidate.code} · VNĐ${!full ? " · Chỉ xem công nợ ứng viên" : ""}`}
      />
      <Link
        href={FINANCE_PATH}
        className="text-primary mb-4 inline-block underline"
      >
        ← Danh sách tài chính
      </Link>
      <div className="mb-5 flex flex-wrap gap-3">
        {full &&
          Object.entries(FINANCE_KINDS).map(([kind, label]) => (
            <Button
              key={kind}
              asChild
              variant={kind === filters.kind ? "default" : "outline"}
            >
              <Link href={`${FINANCE_PATH}/${candidateId}?kind=${kind}`}>
                {label}
              </Link>
            </Button>
          ))}
      </div>
      <FinanceSummary totals={result.totals} commission={commission} />
      {full && (
        <div className="mb-5 flex flex-wrap gap-3">
          <InstallmentDialog
            candidateId={candidateId}
            candidateName={result.candidate.full_name}
            kind={filters.kind}
          />
          <FinanceHistoryDialog candidateId={candidateId} />
        </div>
      )}
      <div className="grid gap-4">
        {result.rows.map((i) => (
          <section key={i.id} className="bg-card rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-semibold">{i.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {i.code} · Hạn {i.due_date.split("-").reverse().join("/")}
                  {i.due_date < today && i.balance > 0 ? " · Quá hạn" : ""}
                </p>
                {full && (
                  <p className="mt-1 text-sm">
                    {commission ? "CTV" : "Đối tượng đóng phí"}:{" "}
                    {i.counterparty}
                  </p>
                )}
              </div>
              <strong>
                {commission ? "Còn phải chi" : "Còn nợ"}: {moneyVnd(i.balance)}
              </strong>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                {commission ? "Phải chi" : "Phí phải thu hiện tại"}:{" "}
                {moneyVnd(i.amount)}
              </p>
              <p>
                {commission ? "Đã chi" : "Đã thu"}: {moneyVnd(i.paid)}
              </p>
              {!commission && (
                <>
                  <p>Đã hoàn: {moneyVnd(i.refunded)}</p>
                  <p>Thực thu sau hoàn: {moneyVnd(i.net_paid)}</p>
                </>
              )}
            </div>
            {full && i.note && (
              <p className="text-muted-foreground mt-3 text-sm break-words whitespace-pre-wrap">
                {i.note}
              </p>
            )}
            {full && (
              <div className="mt-4 flex flex-wrap gap-2">
                <InstallmentDialog
                  candidateId={candidateId}
                  candidateName={result.candidate.full_name}
                  kind={filters.kind}
                  installment={i}
                />
                <TransactionDialog installment={i} today={today} />
                <TransactionsDialog installment={i} today={today} />
              </div>
            )}
          </section>
        ))}
        {!result.rows.length && (
          <p>Chưa có đợt {FINANCE_KINDS[filters.kind].toLowerCase()}.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
        <p>
          {result.total} đợt · Trang {filters.page + 1}
        </p>
        <div className="flex gap-3">
          {filters.page > 0 && (
            <Link href={`?kind=${filters.kind}&page=${filters.page - 1}`}>
              Trang trước
            </Link>
          )}
          {(filters.page + 1) * 25 < result.total && (
            <Link href={`?kind=${filters.kind}&page=${filters.page + 1}`}>
              Trang sau
            </Link>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-5 text-xs">
        Phí hiện tại đã tính các lần hoàn có giảm phí. Hoàn giữ nguyên phí sẽ
        tăng công nợ. Hủy phiếu không xóa lịch sử; chuyển bước pipeline không tự
        tạo khoản thu/chi.
      </p>
    </>
  );
}
