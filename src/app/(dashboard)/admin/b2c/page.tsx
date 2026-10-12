import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lớp trung tâm (B2C)" };

export default async function B2CDashboardPage() {
  await requireManager();

  return (
    <>
      <PageHeader
        title="Lớp trung tâm (B2C)"
        description="Không gian quản lý riêng cho học viên lẻ và các lớp mở trực tiếp tại trung tâm."
      />

      <section aria-labelledby="b2c-groups-heading">
        <h2 id="b2c-groups-heading" className="mb-3 text-lg font-semibold">
          Nhóm chương trình
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {B2C_PROGRAMS.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.title}
                href={`/admin/b2c/${group.slug}`}
                className="focus-visible:ring-ring group rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Card className="hover:border-primary/50 h-full py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CardHeader className="flex-row items-center gap-3 px-5 pt-5">
                    <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
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
