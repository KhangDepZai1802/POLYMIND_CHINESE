import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import {
  XKLD_READ_ROLES,
  canEditXkld,
  CANDIDATES_PATH,
} from "@/features/xkld/domain/candidates";
import {
  PIPELINE_PATH,
  PIPELINE_STAGES,
  STAGE_CODES,
  pipelineFiltersSchema,
} from "@/features/xkld/domain/pipeline";
import { getPipeline } from "@/features/xkld/server/pipeline";
import {
  PipelineDialog,
  ProgressHistoryDialog,
} from "@/features/xkld/components/pipeline-dialogs";
export const metadata: Metadata = { title: "Pipeline XKLĐ" };
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(...XKLD_READ_ROLES);
  const params = await searchParams;
  const parsed = pipelineFiltersSchema.safeParse(
    Object.fromEntries(
      ["q", "stage", "assignee", "page"].map((key) => [
        key,
        typeof params[key] === "string" ? params[key] : undefined,
      ]),
    ),
  );
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Pipeline XKLĐ" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={PIPELINE_PATH}>Xóa bộ lọc</Link>
      </>
    );
  const filters = parsed.data;
  const { actor, groups, assignees } = await getPipeline(filters);
  const editable = canEditXkld(actor.role);
  const visible = groups.filter(
    (g) => !filters.stage || g.stage === filters.stage,
  );
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  const href = (stage: string, page = 0) =>
    `${PIPELINE_PATH}?${new URLSearchParams({ ...filters, stage, page: String(page) })}`;
  return (
    <>
      <PageHeader
        title="Pipeline XKLĐ"
        description="Theo dõi từ Lead đến Hậu xuất cảnh, đơn hàng và lớp đào tạo B2C."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {total.toLocaleString("vi-VN")} ứng viên
          {!editable ? " · Chế độ chỉ xem" : ""}
        </p>
        <Button asChild variant="outline">
          <Link href={CANDIDATES_PATH}>Danh sách ứng viên</Link>
        </Button>
      </div>
      <form className="bg-card mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm">
          Tìm ứng viên
          <Input
            name="q"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Mã, họ tên, SĐT…"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Người phụ trách
          <select
            name="assignee"
            defaultValue={filters.assignee}
            className="border-input bg-background h-10 rounded-md border px-3"
          >
            <option value="">Tất cả</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Giai đoạn
          <select
            name="stage"
            defaultValue={filters.stage}
            className="border-input bg-background h-10 rounded-md border px-3"
          >
            <option value="">Tất cả 10 bước</option>
            {STAGE_CODES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGES[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Lọc</Button>
          <Button asChild variant="outline">
            <Link href={PIPELINE_PATH}>Xóa lọc</Link>
          </Button>
        </div>
      </form>
      <nav
        aria-label="Các giai đoạn pipeline"
        className="mb-5 flex gap-2 overflow-x-auto pb-2"
      >
        {groups.map((g, i) => (
          <Link
            key={g.stage}
            href={href(g.stage)}
            aria-current={filters.stage === g.stage ? "page" : undefined}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${filters.stage === g.stage ? "border-primary bg-blue-50" : "bg-card"}`}
          >
            {i + 1}. {PIPELINE_STAGES[g.stage]}{" "}
            <span className="ml-1 font-semibold">{g.total}</span>
          </Link>
        ))}
      </nav>
      <div
        className="flex items-start gap-4 overflow-x-auto pb-4"
        role="region"
        aria-label="Bảng pipeline, cuộn ngang để xem các bước"
        tabIndex={0}
      >
        {visible.map((group) => (
          <section
            key={group.stage}
            aria-labelledby={`stage-${group.stage}`}
            className={`bg-muted/40 shrink-0 rounded-xl border p-3 ${filters.stage ? "w-full" : "w-72"}`}
          >
            <h2
              id={`stage-${group.stage}`}
              className="mb-3 flex justify-between gap-2 text-sm font-semibold"
            >
              <span>{PIPELINE_STAGES[group.stage]}</span>
              <span>{group.total}</span>
            </h2>
            <div
              className={
                filters.stage
                  ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                  : "space-y-3"
              }
            >
              {group.candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="bg-card space-y-2 rounded-lg border p-3 text-sm"
                >
                  <p className="text-muted-foreground font-mono text-xs">
                    {candidate.code}
                  </p>
                  <h3 className="font-semibold break-words">
                    {candidate.full_name}
                  </h3>
                  <p>{candidate.phone}</p>
                  <p className="text-muted-foreground">
                    Phụ trách: {candidate.assignee_name ?? "Chưa xác định"}
                  </p>
                  <p className="break-words">
                    Đơn hàng:{" "}
                    {candidate.order_code
                      ? `${candidate.order_code} · ${candidate.order_employer}`
                      : "Chưa gắn"}
                  </p>
                  <p className="break-words">
                    Lớp B2C: {candidate.class_label ?? "Chưa liên kết"}
                  </p>
                  <div className="flex flex-wrap gap-1 border-t pt-2">
                    {editable && <PipelineDialog candidate={candidate} />}
                    <ProgressHistoryDialog candidate={candidate} />
                  </div>
                </article>
              ))}
            </div>
            {!group.candidates.length && (
              <p className="text-muted-foreground py-5 text-center text-sm">
                Chưa có ứng viên ở trang này.
              </p>
            )}
            {!filters.stage && group.total > 20 && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3 w-full"
              >
                <Link href={href(group.stage)}>
                  Xem tất cả {group.total} ứng viên
                </Link>
              </Button>
            )}
            {filters.stage && (
              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <span>Trang {filters.page + 1} · 20 ứng viên/trang</span>
                <div className="flex gap-2">
                  {filters.page > 0 && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={href(group.stage, filters.page - 1)}>
                        Trước
                      </Link>
                    </Button>
                  )}
                  {(filters.page + 1) * 20 < group.total && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={href(group.stage, filters.page + 1)}>
                        Sau
                      </Link>
                    </Button>
                  )}
                  {filters.page > 0 && group.candidates.length === 0 && (
                    <Link href={href(group.stage)}>Về trang đầu</Link>
                  )}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Mỗi cột tải tối đa 20 ứng viên. Bấm giai đoạn để xem và phân trang. Tiền
        đặt cọc, ghi danh B2C và hồ sơ xuất cảnh chưa tự phát sinh từ thao tác
        chuyển bước.
      </p>
    </>
  );
}
