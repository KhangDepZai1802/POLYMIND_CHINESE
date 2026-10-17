import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/types/roles";
import {
  b2cHistoryFilterSchema,
  HISTORY_ENTITY_LABELS,
  historyChanges,
} from "@/features/b2c/domain/change-history";
import { getB2CChangeHistory } from "@/features/b2c/server/change-history";

export const metadata: Metadata = { title: "Nhật ký thay đổi" };
export default async function B2CChangeHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("super_admin");
  const params = await searchParams;
  const input = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const parsed = b2cHistoryFilterSchema.safeParse(input);
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Nhật ký thay đổi" />
        <p role="alert" className="text-destructive">
          Bộ lọc không hợp lệ: {parsed.error.issues[0]?.message}
        </p>
        <Link
          href="/admin/b2c/history"
          className="text-primary mt-3 inline-block underline"
        >
          Xóa bộ lọc
        </Link>
      </>
    );
  const filters = parsed.data;
  const result = await getB2CChangeHistory(filters);
  const pages = Math.max(1, Math.ceil(result.total / 30));
  const href = (page: number) =>
    `/admin/b2c/history?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return (
    <>
      <PageHeader
        title="Nhật ký thay đổi"
        description="Ai sửa học phí, trạng thái, thời điểm và dữ liệu trước/sau. Chỉ quản trị viên được xem."
      />
      <form
        className="bg-card mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-6"
        method="get"
      >
        {filters.enrollment && (
          <input type="hidden" name="enrollment" value={filters.enrollment} />
        )}
        <label className="grid gap-1 text-xs">
          Học viên / lớp
          <Input
            name="q"
            defaultValue={filters.q}
            maxLength={200}
            placeholder="Tên, mã học viên hoặc lớp…"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Người thao tác
          <Input
            name="actor"
            defaultValue={filters.actor}
            maxLength={200}
            placeholder="Tên người sửa…"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Loại thay đổi
          <select
            name="kind"
            defaultValue={filters.kind}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="all">Tất cả</option>
            {Object.entries(HISTORY_ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Từ ngày
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-xs">
          Đến ngày
          <Input type="date" name="to" defaultValue={filters.to} />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Lọc</Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/b2c/history">Xóa lọc</Link>
          </Button>
        </div>
      </form>
      <p className="text-muted-foreground mb-3 text-xs">
        Nhật ký bắt đầu từ khi tính năng được bật, không khôi phục được người
        sửa của các thay đổi trước đó. Thời gian hiển thị theo Việt Nam. Dữ liệu
        lịch sử chỉ đọc.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[950px] text-left text-sm">
          <caption className="sr-only">
            Lịch sử thay đổi học phí và ghi danh
          </caption>
          <thead className="bg-muted">
            <tr>
              {[
                "Thời gian",
                "Người thao tác",
                "Học viên / lớp",
                "Thao tác",
                "Nội dung thay đổi",
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => {
              const changes = historyChanges(row.before_data, row.after_data);
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {row.actor_name ??
                        (row.actor_id
                          ? "Tài khoản không còn hồ sơ"
                          : "Hệ thống / ngoài phiên đăng nhập")}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.actor_role
                        ? ROLE_LABELS[row.actor_role]
                        : "Không có vai trò đăng nhập"}
                    </p>
                    {row.actor_id && (
                      <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                        {row.actor_id}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.student_name ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.student_code ?? "—"}
                    </p>
                    <p className="mt-1 text-xs">
                      {row.class_name ?? "—"} · {row.class_code ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{HISTORY_ENTITY_LABELS[row.entity_type]}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.operation === "INSERT"
                        ? "Tạo mới"
                        : row.operation === "DELETE"
                          ? "Xóa"
                          : "Cập nhật"}
                    </p>
                  </td>
                  <td className="min-w-80 px-4 py-3">
                    <details>
                      <summary className="text-primary cursor-pointer">
                        Xem {changes.length} trường thay đổi
                      </summary>
                      <dl className="mt-3 space-y-3">
                        {changes.map((change) => (
                          <div key={change.key}>
                            <dt className="text-xs font-semibold">
                              {change.label}
                            </dt>
                            <dd className="mt-1 grid gap-1 text-xs break-words whitespace-pre-wrap">
                              <span className="text-muted-foreground">
                                Trước: {change.before}
                              </span>
                              <span>Sau: {change.after}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </td>
                </tr>
              );
            })}
            {!result.rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground py-12 text-center"
                >
                  Chưa có thay đổi phù hợp. Những lần sửa từ khi bật nhật ký sẽ
                  xuất hiện tại đây.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="Phân trang nhật ký"
        className="mt-4 flex items-center justify-between gap-3 text-sm"
      >
        <span>
          {result.total} thay đổi · Trang {filters.page + 1}/{pages}
        </span>
        <div className="flex gap-2">
          {filters.page > 0 ? (
            <Button variant="outline" asChild>
              <Link href={href(filters.page - 1)}>Trước</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Trước
            </Button>
          )}
          {(filters.page + 1) * 30 < result.total ? (
            <Button variant="outline" asChild>
              <Link href={href(filters.page + 1)}>Sau</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Sau
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}
