import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, School } from "lucide-react";

import { CourseFormDialog } from "@/features/courses/components/course-form-dialog";
import { CurriculumEditor } from "@/features/courses/components/curriculum-editor";
import {
  getCourseById,
  getCourseClasses,
  getCourseCurriculum,
  getLevels,
} from "@/features/courses/server/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatDate } from "@/lib/dates";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  COURSE_STATUS_LABELS,
  COURSE_STATUS_TONE,
  COURSE_TYPE_LABELS,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Chi tiết khóa học" };

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;

  const course = await getCourseById(id);
  if (!course) notFound();

  const [curriculum, classes, levels] = await Promise.all([
    getCourseCurriculum(id),
    getCourseClasses(id),
    getLevels(),
  ]);

  const lessonCount = curriculum.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <Link
        href="/admin/courses"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Danh sách khóa học
      </Link>

      <PageHeader
        title={course.title}
        description={course.title_en ?? undefined}
        action={
          <CourseFormDialog
            levels={levels}
            course={course}
            trigger={<Button variant="outline">Sửa khóa học</Button>}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="bg-muted rounded px-2 py-1 font-mono text-xs font-medium">
          {course.code}
        </span>
        <StatusBadge
          label={COURSE_STATUS_LABELS[course.status]}
          tone={COURSE_STATUS_TONE[course.status]}
        />
        <span className="text-muted-foreground text-sm">
          {COURSE_TYPE_LABELS[course.course_type]}
          {course.level ? ` · ${course.level.name}` : ""}
        </span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="curriculum">
            Giáo trình ({lessonCount})
          </TabsTrigger>
          <TabsTrigger value="classes">Lớp đã mở ({classes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-semibold">Thông tin chương trình</h3>
                <Field label="Đối tượng" value={course.target_audience} />
                <Field label="Mục tiêu" value={course.objectives} />
                <Field label="Mô tả" value={course.description} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-semibold">Giá trị mặc định</h3>
                  <p className="text-muted-foreground -mt-2 text-xs">
                    Chỉ là gợi ý khi mở lớp. Số buổi thật chốt ở từng lớp.
                  </p>
                  <Field
                    label="Số buổi"
                    value={
                      course.default_session_count
                        ? `${course.default_session_count} buổi`
                        : null
                    }
                  />
                  <Field
                    label="Thời lượng"
                    value={
                      course.default_session_duration_minutes
                        ? `${course.default_session_duration_minutes} phút/buổi`
                        : null
                    }
                  />
                  <Field
                    label="Học phí"
                    value={
                      course.default_tuition_amount
                        ? formatCurrency(course.default_tuition_amount)
                        : null
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-semibold">Điều kiện hoàn thành</h3>
                  <Field
                    label="Chuyên cần tối thiểu"
                    value={`${course.completion_min_attendance_rate}%`}
                  />
                  <Field
                    label="Điểm tối thiểu"
                    value={`${course.completion_min_overall_score}/100`}
                  />
                  <Field
                    label="Bắt buộc nộp đủ bài tập"
                    value={
                      course.completion_require_all_assignments ? "Có" : "Không"
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="curriculum" className="mt-4">
          <CurriculumEditor courseId={id} modules={curriculum} />
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {classes.length === 0 ? (
                <EmptyState
                  icon={School}
                  title="Chưa mở lớp nào từ khóa học này"
                  description="Vào mục Lớp học để mở lớp triển khai."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/admin/classes">Đi tới Lớp học</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y">
                  {classes.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {c.code}
                            </span>
                            <StatusBadge
                              label={CLASS_STATUS_LABELS[c.status]}
                              tone={CLASS_STATUS_TONE[c.status]}
                            />
                          </div>
                          <p className="mt-1 truncate font-medium">{c.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {DELIVERY_MODE_LABELS[c.delivery_mode]} · Sĩ số tối đa{" "}
                            {c.capacity} · Khai giảng {formatDate(c.start_date)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm whitespace-pre-line">{value ?? "—"}</p>
    </div>
  );
}
