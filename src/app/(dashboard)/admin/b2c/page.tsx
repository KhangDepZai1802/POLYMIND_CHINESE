import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { getB2CStudentCounts } from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lớp trung tâm (B2C)" };

export default async function B2CDashboardPage() {
  await requireManager();
  const studentCounts = await getB2CStudentCounts();

  return (
    <>
      <PageHeader
        title="Lớp trung tâm (B2C)"
        description="Không gian quản lý riêng cho học viên lẻ và các lớp mở trực tiếp tại trung tâm."
      />

      <section aria-labelledby="b2c-groups-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="b2c-groups-heading" className="text-lg font-semibold">
            Nhóm chương trình
          </h2>
          <p className="text-muted-foreground text-sm tabular-nums">
            Tổng: {studentCounts.total.toLocaleString("vi-VN")} học viên
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {B2C_PROGRAMS.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.title}
                href={`/admin/b2c/${group.slug}`}
                className="focus-visible:ring-ring group rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Card className="hover:border-primary/50 relative h-full py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <p className="text-primary absolute top-5 right-5 text-sm font-semibold tabular-nums">
                    {(studentCounts.byProgram[group.slug] ?? 0).toLocaleString("vi-VN")} học viên
                  </p>
                  <CardHeader className="flex-row items-center gap-3 pr-32 pl-5 pt-5">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${group.iconClassName}`}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base">{group.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pt-3 pb-5">
                    <p className="text-muted-foreground text-sm leading-6">
                      {group.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
