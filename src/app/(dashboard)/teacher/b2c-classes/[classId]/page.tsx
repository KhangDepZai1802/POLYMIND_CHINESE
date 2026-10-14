import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMyB2CClass } from "@/features/b2c/server/teacher-class-queries";
import { requireTeaching } from "@/lib/auth/session";
import { formatDate, formatDateOnly, formatTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Chi tiết lớp B2C" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const tabs = {
  students: "Học viên",
  schedule: "Lịch học",
  comments: "Nhận xét",
};
const statuses: Record<string, string> = {
  active: "Đang học",
  paused: "Tạm nghỉ",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
  planned: "Theo kế hoạch",
  dropped: "Đã nghỉ",
  studying: "Đang học",
};

export default async function TeacherB2CClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  await requireTeaching();
  const { classId } = await params;
  if (!z.uuid().safeParse(classId).success) notFound();
  const search = await searchParams;
  const tab = Object.hasOwn(tabs, search.tab ?? "") ? search.tab! : "students";
  const page = Math.min(
    1000000,
    Math.max(0, Number.parseInt(search.page ?? "0", 10) || 0),
  );
  const query = (search.q ?? "").slice(0, 200);
  const result = await getMyB2CClass(classId, tab, page, query);
  if (!result) notFound();
  const base = `/teacher/b2c-classes/${classId}`;
  const url = (next: number) =>
    `${base}?${new URLSearchParams({ tab, q: query, page: String(next) })}`;
  return (
    <>
      <BackLink href="/teacher/classes" label="Lớp của tôi" />
      <PageHeader
        title={result.class.name}
        description={`${result.class.code} · ${[result.class.weekdays_text, result.class.time_text].filter(Boolean).join(" · ") || "Chưa cập nhật lịch học"}`}
      />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Chi tiết lớp B2C">
        {Object.entries(tabs).map(([key, title]) => (
          <Button
            asChild
            key={key}
            variant={tab === key ? "default" : "outline"}
          >
            <Link
              href={`${base}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
            >
              {title}
            </Link>
          </Button>
        ))}
        <Button asChild variant="outline">
          <Link href="/teacher/b2c-teaching">Chấm công B2C</Link>
        </Button>
      </nav>
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <h2 className="font-semibold">
            {tabs[tab as keyof typeof tabs]} ({result.total})
          </h2>
          {tab === "students" && (
            <form className="flex gap-2">
              <input type="hidden" name="tab" value={tab} />
              <Input
                name="q"
                aria-label="Tìm học viên"
                placeholder="Tìm mã, tên học viên…"
                defaultValue={query}
                maxLength={200}
              />
              <Button type="submit">Tìm</Button>
            </form>
          )}
          {result.rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm">
              Chưa có dữ liệu phù hợp.
            </p>
          ) : (
            <ul className="divide-y">
              {result.rows.map((row, index) => (
                <li
                  key={row.id ?? row.code ?? index}
                  className="space-y-1 py-3 text-sm"
                >
                  {tab === "students" ? (
                    <>
                      <p className="font-medium">{row.full_name}</p>
                      <p className="text-muted-foreground">
                        {row.code} · {statuses[row.status ?? ""] ?? row.status}
                      </p>
                      <p>Nhập học: {formatDateOnly(row.enrollment_date)}</p>
                    </>
                  ) : tab === "schedule" ? (
                    <>
                      <p className="font-medium">
                        {formatDate(row.starts_at)} ·{" "}
                        {formatTime(row.starts_at!)}–{formatTime(row.ends_at!)}
                      </p>
                      <p>
                        {row.teacher_name || "Chưa cập nhật giáo viên"} · {row.room_name || "Chưa xếp phòng"} ·{" "}
                        {statuses[row.status ?? ""] ?? row.status}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">
                        {row.full_name} · {row.code}
                      </p>
                      <p className="break-words whitespace-pre-wrap">
                        {row.content}
                      </p>
                      <p className="text-muted-foreground">
                        {row.actor_name} · {formatDate(row.created_at)}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              {result.total} kết quả · Trang {page + 1}/
              {Math.max(1, Math.ceil(result.total / 25))}
            </p>
            <div className="flex gap-2">
              {page > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={url(page - 1)}>Trước</Link>
                </Button>
              )}
              {(page + 1) * 25 < result.total && (
                <Button asChild variant="outline" size="sm">
                  <Link href={url(page + 1)}>Sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
