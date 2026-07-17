import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, School } from "lucide-react";

import { ClassFormDialog } from "@/features/classes/components/class-form-dialog";
import {
  getClasses,
  getCourseOptionsForClasses,
} from "@/features/classes/server/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lớp học" };

const OPEN_ENROLLMENT_STATUSES = new Set(["pending", "active", "paused"]);

export default async function AdminClassesPage() {
  await requireRole("super_admin");
  const [classes, courses] = await Promise.all([
    getClasses(),
    getCourseOptionsForClasses(),
  ]);

  return (
    <>
      <PageHeader
        title="Lớp học"
        description={`${classes.length} lớp triển khai từ các chương trình đào tạo.`}
        action={<ClassFormDialog courses={courses} />}
      />

      <Card>
        <CardContent className="p-0">
          {classes.length === 0 ? (
            <EmptyState
              icon={School}
              title="Chưa có lớp học nào"
              description="Mở lớp từ một khóa học, sau đó phân công giáo viên và cấu hình lịch."
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã lớp</TableHead>
                      <TableHead>Tên lớp / Khóa học</TableHead>
                      <TableHead>Giáo viên chính</TableHead>
                      <TableHead>Hình thức</TableHead>
                      <TableHead>Khai giảng</TableHead>
                      <TableHead className="text-right">Sĩ số</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((classRecord) => {
                      const primary = classRecord.class_teachers;
                      const openCount = classRecord.enrollments.filter(
                        (enrollment) =>
                          OPEN_ENROLLMENT_STATUSES.has(enrollment.status),
                      ).length;

                      return (
                        <TableRow key={classRecord.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {classRecord.code}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/classes/${classRecord.id}`}
                              className="hover:text-primary font-medium hover:underline"
                            >
                              {classRecord.name}
                            </Link>
                            <p className="text-muted-foreground text-xs">
                              {classRecord.course?.code} —{" "}
                              {classRecord.course?.title}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {primary?.teacher?.profile?.full_name ?? (
                              <span className="text-muted-foreground">
                                Chưa phân công
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(classRecord.start_date)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {openCount}/{classRecord.capacity}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              label={CLASS_STATUS_LABELS[classRecord.status]}
                              tone={CLASS_STATUS_TONE[classRecord.status]}
                            />
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/classes/${classRecord.id}`}
                              aria-label={`Xem lớp ${classRecord.name}`}
                            >
                              <ChevronRight className="text-muted-foreground size-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y lg:hidden">
                {classes.map((classRecord) => {
                  const primary = classRecord.class_teachers;
                  const openCount = classRecord.enrollments.filter(
                    (enrollment) =>
                      OPEN_ENROLLMENT_STATUSES.has(enrollment.status),
                  ).length;

                  return (
                    <li key={classRecord.id}>
                      <Link
                        href={`/admin/classes/${classRecord.id}`}
                        className="hover:bg-muted/40 flex items-center gap-3 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {classRecord.code}
                            </span>
                            <StatusBadge
                              label={CLASS_STATUS_LABELS[classRecord.status]}
                              tone={CLASS_STATUS_TONE[classRecord.status]}
                            />
                          </div>
                          <p className="mt-1 truncate font-medium">
                            {classRecord.name}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {classRecord.course?.title} · {openCount}/
                            {classRecord.capacity} HV
                          </p>
                          <p className="text-muted-foreground mt-1 truncate text-xs">
                            {primary?.teacher?.profile?.full_name ??
                              "Chưa có GV chính"}{" "}
                            · {DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                          </p>
                        </div>
                        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
