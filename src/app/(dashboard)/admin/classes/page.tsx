import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, School } from "lucide-react";

import { ClassFormDialog } from "@/features/classes/components/class-form-dialog";
import {
  getClasses,
  getCourseOptionsForClasses,
} from "@/features/classes/server/queries";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
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

      <Card className="py-0">
        <CardContent className="p-0">
          {classes.length === 0 ? (
            <EmptyState
              icon={School}
              title="Chưa có lớp học nào"
              description="Mở lớp từ một khóa học, sau đó phân công giáo viên và cấu hình lịch."
            />
          ) : (
            /*
             * MỘT bảng cho mọi bề rộng (`DS-044`). Bản điện thoại cũ bỏ hẳn
             * **Khai giảng** — ngày quyết định lớp nào sắp mở — nên không tra
             * được trên điện thoại.
             */
            <DataTable
              caption="Danh sách lớp học: mã lớp, tên lớp và khóa học, giáo viên chính, hình thức, ngày khai giảng, sĩ số và trạng thái"
              minWidthClass="min-w-[60rem]"
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead sticky>Mã lớp</DataTableHead>
                  <DataTableHead>Tên lớp / Khóa học</DataTableHead>
                  <DataTableHead>Giáo viên chính</DataTableHead>
                  <DataTableHead>Hình thức</DataTableHead>
                  <DataTableHead>Khai giảng</DataTableHead>
                  <DataTableHead numeric>Sĩ số</DataTableHead>
                  <DataTableHead>Trạng thái</DataTableHead>
                  <DataTableHead className="w-10">
                    <span className="sr-only">Xem chi tiết</span>
                  </DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {classes.map((classRecord) => {
                  const primary = classRecord.class_teachers;
                  const openCount = classRecord.enrollments.filter(
                    (enrollment) =>
                      OPEN_ENROLLMENT_STATUSES.has(enrollment.status),
                  ).length;

                  return (
                    <DataTableRow key={classRecord.id}>
                      <DataTableCell
                        sticky
                        className="font-mono text-sm font-medium"
                      >
                        {classRecord.code}
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={`/admin/classes/${classRecord.id}`}
                          className="hover:text-primary focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {classRecord.name}
                        </Link>
                        <p className="text-text-secondary text-sm">
                          {classRecord.course?.code} —{" "}
                          {classRecord.course?.title}
                        </p>
                      </DataTableCell>
                      <DataTableCell>
                        {primary?.teacher?.profile?.full_name ?? (
                          <span className="text-text-secondary">
                            Chưa phân công
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                      </DataTableCell>
                      <DataTableCell>
                        {formatDateOnly(classRecord.start_date)}
                      </DataTableCell>
                      <DataTableCell numeric>
                        {openCount}/{classRecord.capacity}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          label={CLASS_STATUS_LABELS[classRecord.status]}
                          tone={CLASS_STATUS_TONE[classRecord.status]}
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={`/admin/classes/${classRecord.id}`}
                          aria-label={`Xem lớp ${classRecord.name}`}
                          className="focus-visible:ring-ring inline-flex rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <ChevronRight
                            className="text-text-secondary size-4"
                            aria-hidden
                          />
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </>
  );
}
