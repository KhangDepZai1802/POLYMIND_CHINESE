import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentManager } from "@/features/assignments/components/assignment-manager";
import {
  getAssignmentClassContext,
  getAssignmentClassOptions,
  getAssignmentsForClass,
} from "@/features/assignments/server/queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { requireRole } from "@/lib/auth/session";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Bài tập & Chấm bài" };

export default async function TeacherAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole("teacher");
  const { class: requestedClassId } = await searchParams;
  const classes = await getAssignmentClassOptions();
  const selectedClassId = classes.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : classes[0]?.id;

  const [context, assignments] = selectedClassId
    ? await Promise.all([
        getAssignmentClassContext(selectedClassId),
        getAssignmentsForClass(selectedClassId),
      ])
    : [null, []];

  return (
    <>
      <PageHeader
        title="Bài tập & Chấm bài"
        description="Tạo bản nháp, đính kèm đề bài và giao bài cho đúng lớp bạn phụ trách."
      />

      <div className="mb-5">
        <ClassPicker
          classes={classes}
          selectedId={context?.id}
          basePath="/teacher/assignments"
          placeholder="Chọn lớp để quản lý bài tập"
        />
      </div>

      {!context ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileCheck2}
              title="Bạn chưa có lớp để giao bài"
              description="Khi được quản trị viên phân công lớp, bạn có thể tạo và giao bài tập tại đây."
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

          <AssignmentManager
            classId={context.id}
            assignments={assignments}
            lessons={context.lessons}
            sessions={context.class_sessions}
          />
        </>
      )}
    </>
  );
}
