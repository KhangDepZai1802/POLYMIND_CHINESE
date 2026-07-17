import Link from "next/link";

import {
  auditFilterSearchParams,
  parseAuditFilters,
  type AuditFilters,
} from "@/features/audit/schema";
import {
  getAuditActors,
  getAuditLogPage,
} from "@/features/audit/server/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/dates";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

/** Tab "Nhật ký audit": lịch sử thay đổi append-only, có bộ lọc và phân trang. */
export async function AuditLogView({ searchParams }: Props) {
  const parsed = parseAuditFilters(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1 };
  const [log, actors] = await Promise.all([
    getAuditLogPage(filters),
    getAuditActors(),
  ]);

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bộ lọc audit</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <input type="hidden" name="tab" value="audit" />
            <label className="grid gap-1 text-sm font-medium">
              Hành động
              <Input name="action" defaultValue={filters.action} placeholder="vd. tuition" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Loại tài nguyên
              <Input
                name="resource_type"
                defaultValue={filters.resource_type}
                placeholder="vd. class"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Người thao tác
              <select
                name="actor_id"
                defaultValue={filters.actor_id ?? ""}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Tất cả</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.full_name} — {actor.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Từ ngày
              <Input name="from" type="date" defaultValue={filters.from} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Đến ngày
              <Input name="to" type="date" defaultValue={filters.to} />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">Áp dụng</Button>
              <Button asChild variant="ghost">
                <Link href="/admin/system?tab=audit">Xóa lọc</Link>
              </Button>
            </div>
          </form>
          {!parsed.success && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {parsed.error.issues[0]?.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                {[
                  "Thời gian",
                  "Actor",
                  "Role",
                  "Hành động",
                  "Tài nguyên",
                  "Thay đổi",
                ].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.rows.map((row) => (
                <tr key={row.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.actor?.full_name ?? "Hệ thống"}</p>
                    <p className="text-xs text-muted-foreground">{row.actor?.email}</p>
                  </td>
                  <td className="px-4 py-3">{row.actor_role ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-3">
                    <p>{row.resource_type}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.resource_id ?? "—"}
                    </p>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <AuditChange before={row.before} after={row.after} />
                  </td>
                </tr>
              ))}
              {log.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Không có audit event phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <nav aria-label="Phân trang audit" className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {log.total} sự kiện · trang {log.page}/{log.pageCount}
        </p>
        <div className="flex gap-2">
          <PageLink label="Trước" page={log.page - 1} disabled={log.page <= 1} filters={filters} />
          <PageLink
            label="Sau"
            page={log.page + 1}
            disabled={log.page >= log.pageCount}
            filters={filters}
          />
        </div>
      </nav>
    </>
  );
}

function AuditChange({ before, after }: { before: unknown; after: unknown }) {
  if (before === null && after === null) return <span className="text-muted-foreground">—</span>;
  return (
    <details>
      <summary className="cursor-pointer font-medium">Xem dữ liệu thay đổi</summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
        {JSON.stringify({ before, after }, null, 2)}
      </pre>
    </details>
  );
}

function PageLink({
  label,
  page,
  disabled,
  filters,
}: {
  label: string;
  page: number;
  disabled: boolean;
  filters: AuditFilters;
}) {
  if (disabled) return <Button disabled variant="outline">{label}</Button>;
  const params = auditFilterSearchParams({ ...filters, page });
  params.set("tab", "audit");
  return (
    <Button asChild variant="outline">
      <Link href={`/admin/system?${params.toString()}`}>{label}</Link>
    </Button>
  );
}
