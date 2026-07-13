import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

import { CourseFormDialog } from "@/features/courses/components/course-form-dialog";
import { getCourses, getLevels } from "@/features/courses/server/queries";
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
import { formatCurrency } from "@/lib/dates";
import {
  COURSE_STATUS_LABELS,
  COURSE_STATUS_TONE,
  COURSE_TYPE_LABELS,
} from "@/lib/domain/labels";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Khóa học" };

type CourseType = Database["public"]["Enums"]["course_type"];
type CourseRow = Awaited<ReturnType<typeof getCourses>>[number];

/** Dòng cốt lõi hiện trước, B2B hiện sau — đúng cách trung tâm nghĩ về danh mục. */
const CORE_TYPES: CourseType[] = ["hsk", "communication", "kids", "exam_prep"];

export default async function AdminCoursesPage() {
  await requireRole("super_admin");

  const [courses, levels] = await Promise.all([getCourses(), getLevels()]);

  const core = courses.filter((c) => CORE_TYPES.includes(c.course_type));
  const custom = courses.filter((c) => !CORE_TYPES.includes(c.course_type));

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
            title="Chương trình doanh nghiệp / tùy chỉnh"
            description="Thiết kế riêng theo yêu cầu đối tác."
            courses={custom}
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
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Desktop: bảng đầy đủ */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Tên khóa học</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Bậc</TableHead>
                  <TableHead className="text-right">Số buổi</TableHead>
                  <TableHead className="text-right">Học phí</TableHead>
                  <TableHead className="text-right">Lớp đã mở</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-medium">
                      {c.code}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/courses/${c.id}`}
                        className="hover:text-primary font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.title_en && (
                        <p className="text-muted-foreground text-xs">
                          {c.title_en}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {COURSE_TYPE_LABELS[c.course_type]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.level?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {c.default_session_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(c.default_tuition_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {c.classes.length}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={COURSE_STATUS_LABELS[c.status]}
                        tone={COURSE_STATUS_TONE[c.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/courses/${c.id}`}
                        aria-label={`Xem ${c.title}`}
                      >
                        <ChevronRight className="text-muted-foreground size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: card — bảng 9 cột không dùng nổi trên điện thoại */}
          <ul className="divide-y md:hidden">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/courses/${c.id}`}
                  className="hover:bg-muted/40 flex items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium">
                        {c.code}
                      </span>
                      <StatusBadge
                        label={COURSE_STATUS_LABELS[c.status]}
                        tone={COURSE_STATUS_TONE[c.status]}
                      />
                    </div>
                    <p className="mt-1 truncate font-medium">{c.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {COURSE_TYPE_LABELS[c.course_type]}
                      {c.level ? ` · ${c.level.name}` : ""}
                      {` · ${c.classes.length} lớp`}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
