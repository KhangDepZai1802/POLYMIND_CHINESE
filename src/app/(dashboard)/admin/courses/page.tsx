import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

import { CourseFormDialog } from "@/features/courses/components/course-form-dialog";
import { getCourses, getLevels } from "@/features/courses/server/queries";
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
import { formatCurrency } from "@/lib/dates";
import {
  COURSE_STATUS_LABELS,
  COURSE_STATUS_TONE,
  COURSE_TYPE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Khóa học" };

type CourseRow = Awaited<ReturnType<typeof getCourses>>[number];

export default async function AdminCoursesPage() {
  await requireRole("super_admin");

  const [courses, levels] = await Promise.all([getCourses(), getLevels()]);

  const core = courses.filter((course) => course.program === "core");
  const business = courses.filter((course) => course.program === "business");

  return (
    <>
      <PageHeader
        title="Khóa học"
        description="Chương trình đào tạo của trung tâm. Mỗi khóa học có thể mở nhiều lớp."
        action={<CourseFormDialog levels={levels} />}
      />

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BookOpen}
              title="Chưa có khóa học nào"
              description="Tạo khóa học đầu tiên để bắt đầu mở lớp."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <CourseSection
            title="Chương trình cốt lõi"
            description="Danh mục trung tâm giảng dạy thường xuyên."
            courses={core}
          />
          <CourseSection
            title="Chương trình doanh nghiệp"
            description="Thiết kế riêng theo yêu cầu đối tác."
            courses={business}
          />
        </div>
      )}
    </>
  );
}

function CourseSection({
  title,
  description,
  courses,
}: {
  title: string;
  description: string;
  courses: CourseRow[];
}) {
  if (courses.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-text-secondary text-sm">{description}</p>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {/*
           * MỘT bảng cho mọi bề rộng (`DS-044`). Bản điện thoại cũ bỏ hẳn
           * **Học phí** và **Số buổi** — hai con số quyết định khi tư vấn tuyển
           * sinh — nên trên điện thoại quản trị viên không tra được giá khóa học.
           */}
          <DataTable
            caption={`${title}: mã, tên khóa học, loại, bậc, số buổi, học phí, số lớp đã mở và trạng thái`}
            minWidthClass="min-w-[60rem]"
          >
            <DataTableHeader>
              <tr>
                <DataTableHead sticky>Mã</DataTableHead>
                <DataTableHead>Tên khóa học</DataTableHead>
                <DataTableHead>Loại</DataTableHead>
                <DataTableHead>Bậc</DataTableHead>
                <DataTableHead numeric>Số buổi</DataTableHead>
                <DataTableHead numeric>Học phí</DataTableHead>
                <DataTableHead numeric>Lớp đã mở</DataTableHead>
                <DataTableHead>Trạng thái</DataTableHead>
                <DataTableHead className="w-10">
                  <span className="sr-only">Xem chi tiết</span>
                </DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {courses.map((c) => (
                <DataTableRow key={c.id}>
                  <DataTableCell sticky className="font-mono text-sm font-medium">
                    {c.code}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="hover:text-primary focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {c.title}
                    </Link>
                    {c.title_en && (
                      <p className="text-text-secondary text-sm">{c.title_en}</p>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {c.course_type ? COURSE_TYPE_LABELS[c.course_type] : "—"}
                  </DataTableCell>
                  <DataTableCell>{c.level?.name ?? "—"}</DataTableCell>
                  <DataTableCell numeric>
                    {c.default_session_count ?? "—"}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {formatCurrency(c.default_tuition_amount)}
                  </DataTableCell>
                  <DataTableCell numeric>{c.classes.length}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={COURSE_STATUS_LABELS[c.status]}
                      tone={COURSE_STATUS_TONE[c.status]}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/admin/courses/${c.id}`}
                      aria-label={`Xem ${c.title}`}
                      className="focus-visible:ring-ring inline-flex rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <ChevronRight
                        className="text-text-secondary size-4"
                        aria-hidden
                      />
                    </Link>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>
    </section>
  );
}
