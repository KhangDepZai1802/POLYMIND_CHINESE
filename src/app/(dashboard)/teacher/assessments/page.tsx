import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentManager } from "@/features/assessments/components/assessment-manager";
import {
  getAssessmentClassContext,
  getAssessmentsForClass,
} from "@/features/assessments/server/queries";
import { getClassOptions } from "@/features/classes/server/queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { requireRole } from "@/lib/auth/session";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Kiểm tra & Điểm" };

export default async function TeacherAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole("teacher");
  const { class: requestedClassId } = await searchParams;

  // Danh sách lớp do RLS quy về `class_teachers` — không có `where teacher_id`
  // nào ở app. Lớp không có trong danh sách này thì cũng không mở được bằng
  // cách gõ thẳng `?class=<id>`.
  const classes = await getClassOptions();
  const selectedClassId = classes.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : classes[0]?.id;

  const [context, assessments] = selectedClassId
    ? await Promise.all([
        getAssessmentClassContext(selectedClassId),
        getAssessmentsForClass(selectedClassId),
      ])
    : [null, []];

  return (
    <>
      <PageHeader
        title="Kiểm tra & Điểm"
        description="Tạo bài kiểm tra, nhập điểm tổng và 6 kỹ năng, rồi công bố kết quả cho học viên."
      />

      <div className="mb-5">
        <ClassPicker
          classes={classes}
          selectedId={context?.id}
          basePath="/teacher/assessments"
          placeholder="Chọn lớp để quản lý bài kiểm tra"
        />
      </div>

      {!context ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={GraduationCap}
              title="Bạn chưa có lớp để tạo bài kiểm tra"
              description="Khi được quản trị viên phân công lớp, bạn có thể tạo bài kiểm tra và nhập điểm tại đây."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">
              {context.code}
            </span>
            <StatusBadge
              label={CLASS_STATUS_LABELS[context.status]}
              tone={CLASS_STATUS_TONE[context.status]}
            />
            <span className="text-muted-foreground text-sm">
              {context.name} · {context.course?.title ?? "Chưa gắn khóa học"}
            </span>
          </div>

          <AssessmentManager
            classId={context.id}
            assessments={assessments}
            lessons={context.lessons}
          />
        </>
      )}
    </>
  );
}
