import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CandidateDialog } from "@/features/xkld/components/candidate-dialog";
import { candidateFiltersSchema, canEditXkld, CANDIDATE_SOURCES, CANDIDATES_PATH, HEALTH_STATUSES, XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import { getCandidates } from "@/features/xkld/server/candidates";
import { requireRole } from "@/lib/auth/session";
import { PIPELINE_STAGES, PIPELINE_PATH } from "@/features/xkld/domain/pipeline";

export const metadata: Metadata = { title: "Ứng viên XKLĐ" };
type Params = Record<string, string | string[] | undefined>;
export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole(...XKLD_READ_ROLES);
  const params = await searchParams;
  const parsed = candidateFiltersSchema.safeParse(Object.fromEntries(["q", "source", "health", "assignee", "page"].map(key => [key, typeof params[key] === "string" ? params[key] : undefined])));
  if (!parsed.success) return <><PageHeader title="Ứng viên XKLĐ" /><p role="alert">Bộ lọc không hợp lệ.</p><Link href={CANDIDATES_PATH}>Xóa bộ lọc</Link></>;
  const filters = parsed.data;
  const { actor, rows, total, assignees } = await getCandidates(filters);
  const canEdit = canEditXkld(actor.role);
  const owners = new Map(assignees.map(a => [a.id, a.full_name]));
  const pages = Math.max(1, Math.ceil(total / 25));
  function pageHref(page: number) { const query = new URLSearchParams({ ...filters, page: String(page) }); return `${CANDIDATES_PATH}?${query}`; }
  return <>
    <PageHeader title="Ứng viên XKLĐ" description="Hồ sơ ứng viên, thông tin liên hệ, sức khỏe, nguồn và người phụ trách." />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">{total.toLocaleString("vi-VN")} ứng viên{!canEdit ? " · Chế độ chỉ xem" : ""}</p>
      {canEdit && <CandidateDialog assignees={assignees} actorId={actor.id} />}
    </div>
    <form className="bg-card mb-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="grid gap-1 text-sm">Tìm ứng viên<Input name="q" maxLength={200} defaultValue={filters.q} placeholder="Mã, họ tên, SĐT, quê quán…" /></label>
      {[
        { name: "source", label: "Nguồn", value: filters.source, options: Object.entries(CANDIDATE_SOURCES) },
        { name: "health", label: "Sức khỏe", value: filters.health, options: Object.entries(HEALTH_STATUSES) },
        { name: "assignee", label: "Người phụ trách", value: filters.assignee, options: assignees.map(a => [a.id, a.full_name]) },
      ].map(field => <label key={field.name} className="grid gap-1 text-sm">{field.label}<select name={field.name} defaultValue={field.value} className="border-input bg-background h-10 rounded-md border px-3"><option value="">Tất cả</option>{field.options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
      <div className="flex items-end gap-2"><Button type="submit">Lọc</Button><Button asChild variant="outline"><Link href={CANDIDATES_PATH}>Xóa lọc</Link></Button></div>
    </form>
    <div className="bg-card overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[80rem] text-left text-sm">
        <caption className="sr-only">Hồ sơ ứng viên xuất khẩu lao động</caption>
        <thead className="bg-muted/60"><tr>{["Mã UV", "Họ tên", "Ngày sinh", "SĐT / Zalo", "Quê quán", "Trình độ", "Nghề", "Sức khỏe", "Nguồn", "Người phụ trách", "Pipeline", ...(canEdit ? ["Thao tác"] : [])].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-t">
          <td className="px-4 py-3 font-mono text-xs">{row.code}</td><td className="px-4 py-3 font-medium">{row.full_name}</td>
          <td className="px-4 py-3 whitespace-nowrap">{row.date_of_birth.split("-").reverse().join("/")}</td>
          <td className="px-4 py-3"><p>{row.phone}</p>{row.zalo && <p className="text-muted-foreground max-w-48 break-words">Zalo: {row.zalo}</p>}</td>
          <td className="max-w-56 px-4 py-3 break-words">{row.hometown}</td><td className="px-4 py-3">{row.education}</td><td className="px-4 py-3">{row.occupation}</td>
          <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${row.health_status === "passed" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{HEALTH_STATUSES[row.health_status]}</span></td>
          <td className="px-4 py-3">{CANDIDATE_SOURCES[row.source]}</td><td className="px-4 py-3">{owners.get(row.assignee_id) ?? "Người phụ trách cũ"}</td>
          <td className="px-4 py-3"><Link href={`${PIPELINE_PATH}?q=${encodeURIComponent(row.code)}`} className="text-primary underline underline-offset-4">{PIPELINE_STAGES[row.stage]}</Link><Link href={"/workspace/xkld/documents/" + row.id} className="text-primary mt-2 block underline">Hồ sơ giấy tờ</Link><Link href={"/workspace/xkld/finance/" + row.id} className="text-primary mt-2 block underline">Tài chính & công nợ</Link></td>
          {canEdit && <td className="px-4 py-3"><CandidateDialog candidate={row} assignees={assignees} actorId={actor.id} /></td>}
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="text-muted-foreground p-8 text-center">{total ? "Trang này không có kết quả. Hãy quay về trang đầu." : "Chưa có ứng viên phù hợp. Thêm ứng viên mới hoặc thay đổi bộ lọc."}</p>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p>Trang {filters.page + 1} / {pages} · 25 hồ sơ/trang</p><div className="flex gap-2">{filters.page > 0 && <Button asChild variant="outline"><Link href={pageHref(filters.page - 1)}>Trang trước</Link></Button>}{filters.page + 1 < pages && <Button asChild variant="outline"><Link href={pageHref(filters.page + 1)}>Trang sau</Link></Button>}{filters.page >= pages && <Link href={pageHref(0)}>Về trang đầu</Link>}</div></div>
  </>;
}
