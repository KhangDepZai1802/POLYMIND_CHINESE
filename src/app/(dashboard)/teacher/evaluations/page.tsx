import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardPen, Lock, UserRound } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getClassOptions } from "@/features/classes/server/queries";
import { getEvaluationRoster } from "@/features/evaluations/server/queries";
import { ClassPicker } from "@/features/schedules/components/class-picker";
import { requireRole } from "@/lib/auth/session";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  ENROLLMENT_STATUS_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Đánh giá & Ghi chú" };

export default async function TeacherEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole("teacher");
  const { class: requestedClassId } = await searchParams;

  // RLS quy về `class_teachers` — lớp không có ở đây thì gõ thẳng `?class=` cũng
  // không mở được.
  const classes = await getClassOptions();
  const selected =
    classes.find((item) => item.id === requestedClassId) ?? classes[0];

  const roster = selected ? await getEvaluationRoster(selected.id) : [];

  return (
    <>
      <PageHeader
        title="Đánh giá & Ghi chú"
        description="Viết đánh giá học tập theo kỳ và ghi chú về học viên. Ghi chú nội bộ học viên không đọc được."
      />

      <div className="mb-5">
        <ClassPicker
          classes={classes}
          selectedId={selected?.id}
          basePath="/teacher/evaluations"
          placeholder="Chọn lớp"
        />
      </div>

      {!selected ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardPen}
              title="Bạn chưa có lớp để đánh giá"
              description="Khi được quản trị viên phân công lớp, danh sách học viên sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {selected.code}
            </span>
            <StatusBadge
              label={CLASS_STATUS_LABELS[selected.status]}
              tone={CLASS_STATUS_TONE[selected.status]}
            />
            <span className="text-muted-foreground text-sm">
              {selected.name}
            </span>
          </div>

          {roster.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={UserRound}
                  title="Lớp chưa có học viên đang học"
                  description="Học viên đã rút hoặc chuyển lớp không nằm trong danh sách đánh giá."
                />
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {roster.map((enrollment) => {
                const published = enrollment.learning_evaluations.filter(
                  (item) => item.published_at,
                ).length;
                const internalNotes = enrollment.student_notes.filter(
                  (note) => note.visibility === "staff_only",
                ).length;

                return (
                  <li key={enrollment.id}>
                    <Card>
                      <CardContent className="flex flex-wrap items-center gap-3">
                        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                          <UserRound
                            className="text-muted-foreground size-4"
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {enrollment.student?.full_name ?? "Học viên"}
                          </p>
                          {/*
                            Mã học viên, trạng thái ghi danh và số bản đánh giá là
                            thông tin nghiệp vụ giáo viên phải đọc được, không phải
                            chú thích trang trí — `text-sm` như M25/M26/M27 đã chốt.
                          */}
                          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
                            <span>{enrollment.student?.student_code}</span>
                            <span>·</span>
                            <span>
                              {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                            </span>
                            <span>·</span>
                            <span>
                              {enrollment.learning_evaluations.length} đánh giá (
                              {published} đã gửi)
                            </span>
                            {internalNotes > 0 && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Lock className="size-4" aria-hidden />
                                  {internalNotes} nội bộ
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {/*
                          Cả roster có N nút cùng chữ "Mở hồ sơ". Trình đọc màn
                          hình liệt kê nút theo tên nên nghe ra N mục trùng nhau;
                          thêm tên học viên vào tên gọi được. Vẫn CHỨA nguyên chữ
                          nhìn thấy nên không phạm WCAG 2.5.3 (Label in Name).
                        */}
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/teacher/evaluations/${enrollment.id}`}
                            aria-label={`Mở hồ sơ ${enrollment.student?.full_name ?? "học viên"}`}
                          >
                            Mở hồ sơ
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
