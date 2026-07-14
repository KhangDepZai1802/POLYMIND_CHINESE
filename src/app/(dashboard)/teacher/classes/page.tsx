import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, School, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getClasses } from "@/features/classes/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isOpenEnrollment } from "@/lib/domain/enrollment";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lớp của tôi" };

export default async function TeacherClassesPage() {
  await requireRole("teacher");
  const classes = await getClasses();

  return (
    <>
      <PageHeader
        title="Lớp của tôi"
        description="Các lớp bạn được phân công giảng dạy."
      />

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được phân công lớp nào"
              description="Quản trị viên sẽ phân công lớp cho bạn."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((classRecord) => {
            const openCount = classRecord.enrollments.filter((enrollment) =>
              isOpenEnrollment(enrollment.status),
            ).length;

            return (
              <Link key={classRecord.id} href={`/teacher/classes/${classRecord.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold">
                            {classRecord.code}
                          </span>
                          <StatusBadge
                            label={CLASS_STATUS_LABELS[classRecord.status]}
                            tone={CLASS_STATUS_TONE[classRecord.status]}
                          />
                        </div>
                        <h2 className="truncate font-semibold">{classRecord.name}</h2>
                        <p className="text-muted-foreground mt-1 truncate text-sm">
                          {classRecord.course?.title ?? "Chưa có khóa học"}
                        </p>
                      </div>
                      <ArrowRight
                        className="text-muted-foreground mt-1 size-5 shrink-0"
                        aria-hidden
                      />
                    </div>

                    <div className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Users className="size-4" aria-hidden />
                        {openCount}/{classRecord.capacity} học viên
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-4" aria-hidden />
                        Khai giảng {formatDate(classRecord.start_date)}
                      </span>
                      <span className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="size-4" aria-hidden />
                        {DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                        {classRecord.location_name
                          ? ` · ${classRecord.location_name}`
                          : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
