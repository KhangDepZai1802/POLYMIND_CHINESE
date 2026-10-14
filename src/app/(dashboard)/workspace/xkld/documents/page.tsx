import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCandidates } from "@/features/xkld/server/candidates";
import { candidateFiltersSchema } from "@/features/xkld/domain/candidates";
import { DOCUMENTS_PATH } from "@/features/xkld/domain/documents";
export const metadata = { title: "Hồ sơ giấy tờ XKLĐ" };
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = candidateFiltersSchema.parse({
    q: typeof params.q === "string" ? params.q : "",
    page: typeof params.page === "string" ? params.page : "0",
  });
  const { rows, total } = await getCandidates(filters);
  return (
    <>
      <PageHeader
        title="Hồ sơ giấy tờ XKLĐ"
        description="Checklist theo thị trường, ngày nộp/hết hạn và tệp đính kèm riêng tư."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`${DOCUMENTS_PATH}/checklists`}>Cấu hình checklist</Link>
        </Button>
      </div>
      <form className="mb-5 flex gap-2">
        <Input
          name="q"
          maxLength={200}
          defaultValue={filters.q}
          placeholder="Tìm mã, tên, SĐT ứng viên…"
          aria-label="Tìm ứng viên"
        />
        <Button>Tìm</Button>
      </form>
      <div className="grid gap-3">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`${DOCUMENTS_PATH}/${row.id}`}
            className="bg-card flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span>
              <strong>{row.full_name}</strong>
              <span className="text-muted-foreground block text-sm">
                {row.code} · {row.phone}
              </span>
            </span>
            <span className="text-primary">Mở hồ sơ →</span>
          </Link>
        ))}
        {!rows.length && <p>Không có ứng viên phù hợp.</p>}
      </div>
      <div className="mt-5 flex justify-between gap-3 text-sm">
        <p>
          {total} ứng viên · Trang {filters.page + 1}
        </p>
        <div className="flex gap-3">
          {filters.page > 0 && (
            <Link
              href={`?q=${encodeURIComponent(filters.q)}&page=${filters.page - 1}`}
            >
              Trang trước
            </Link>
          )}
          {(filters.page + 1) * 25 < total && (
            <Link
              href={`?q=${encodeURIComponent(filters.q)}&page=${filters.page + 1}`}
            >
              Trang sau
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
