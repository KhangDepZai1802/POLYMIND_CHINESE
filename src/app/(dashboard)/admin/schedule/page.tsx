import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { getClassOptions } from "@/features/classes/server/queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { ScheduleManager } from "@/features/schedules/components/schedule-manager";
import {
  getClassScheduleBoard,
  getLessonOptionsForClass,
} from "@/features/schedules/server/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { CLASS_STATUS_LABELS, CLASS_STATUS_TONE } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lịch học" };

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole("super_admin");

  const { class: classId } = await searchParams;
  const classes = await getClassOptions();

  const board = classId ? await getClassScheduleBoard(classId) : null;
  const lessons = board?.course
    ? await getLessonOptionsForClass(board.course.id)
    : [];

  return (
    <>
      <PageHeader
        title="Lịch học"
        description="Lịch lặp của lớp và các buổi học sinh ra từ lịch đó."
      />

      <div className="mb-5">
        <ClassPicker classes={classes} selectedId={board?.id} />
      </div>

      {!board ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CalendarDays}
              title="Chọn một lớp"
              description="Lịch lặp và buổi học luôn thuộc về một lớp cụ thể, không phải khóa học. Chọn lớp ở ô trên."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/classes/${board.id}`}
              className="font-mono text-xs font-medium hover:underline"
            >
              {board.code}
            </Link>
            <StatusBadge
              label={CLASS_STATUS_LABELS[board.status]}
              tone={CLASS_STATUS_TONE[board.status]}
            />
            <span className="text-muted-foreground text-sm">
              {board.course?.title ?? "Chưa gắn khóa học"} · Khai giảng{" "}
              {formatDate(board.start_date)}
            </span>
          </div>

          <ScheduleManager
            classId={board.id}
            plannedSessionCount={board.planned_session_count}
            hasStartDate={Boolean(board.start_date)}
            schedules={board.class_schedules}
            sessions={board.class_sessions}
            lessons={lessons}
          />
        </>
      )}
    </>
  );
}
