"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ClipboardList,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAssessmentAction,
  deleteAssessmentAction,
  updateAssessmentAction,
} from "@/features/assessments/server/actions";
import { formatDate, formatScore, toDateInputValue } from "@/lib/dates";
import { ASSESSMENT_TYPE_LABELS } from "@/lib/domain/labels";
import { useFormAction } from "@/lib/use-form-action";
import type { Database } from "@/types/database";

type AssessmentType = Database["public"]["Enums"]["assessment_type"];

type Assessment = {
  id: string;
  class_id: string;
  lesson_id: string | null;
  type: AssessmentType;
  title: string;
  assessment_date: string | null;
  max_score: number;
  published_at: string | null;
  lesson: { id: string; title: string } | null;
  assessment_results: {
    id: string;
    overall_score: number | null;
    published_at: string | null;
  }[];
};

type LessonOption = { id: string; label: string };

const ASSESSMENT_TYPES = Object.entries(ASSESSMENT_TYPE_LABELS) as [
  AssessmentType,
  string,
][];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function AssessmentManager({
  classId,
  assessments,
  lessons,
}: {
  classId: string;
  assessments: Assessment[];
  lessons: LessonOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Bài kiểm tra của lớp</h2>
          <p className="text-muted-foreground text-sm">
            Nhập điểm trước, rà soát rồi mới Công bố. Học viên chỉ thấy kết quả
            sau khi công bố — kể cả gọi thẳng API.
          </p>
        </div>
        <AssessmentDialog classId={classId} lessons={lessons} />
      </div>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={GraduationCap}
              title="Chưa có bài kiểm tra"
              description="Tạo bài kiểm tra, nhập điểm tổng và 6 kỹ năng cho từng học viên, sau đó công bố kết quả bằng một hành động riêng."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              lessons={lessons}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  assessment,
  lessons,
}: {
  assessment: Assessment;
  lessons: LessonOption[];
}) {
  const scored = assessment.assessment_results.filter(
    (result) => result.overall_score !== null,
  ).length;
  const published = assessment.assessment_results.filter(
    (result) => result.published_at,
  ).length;
  const isPublished = assessment.published_at !== null;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{assessment.title}</CardTitle>
              <StatusBadge
                label={isPublished ? "Đã công bố" : "Chưa công bố"}
                tone={isPublished ? "success" : "neutral"}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {ASSESSMENT_TYPE_LABELS[assessment.type]} ·{" "}
              {assessment.assessment_date
                ? formatDate(assessment.assessment_date)
                : "Chưa đặt ngày"}{" "}
              · Thang {formatScore(assessment.max_score)} điểm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/teacher/assessments/${assessment.id}`}>
                <ClipboardList className="size-4" aria-hidden />
                Nhập điểm ({scored})
              </Link>
            </Button>
            <AssessmentDialog
              classId={assessment.class_id}
              lessons={lessons}
              assessment={assessment}
            />
            {!isPublished && <DeleteButton assessment={assessment} />}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>{scored} học viên đã có điểm</span>
          <span>{published} kết quả đã công bố</span>
          {assessment.lesson && <span>Bài học: {assessment.lesson.title}</span>}
          {assessment.published_at && (
            <span>Công bố {formatDate(assessment.published_at)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AssessmentDialog({
  classId,
  lessons,
  assessment,
}: {
  classId: string;
  lessons: LessonOption[];
  assessment?: Assessment;
}) {
  const [open, setOpen] = useState(false);
  const action = assessment ? updateAssessmentAction : createAssessmentAction;
  const { state, formAction } = useFormAction(action, {
    onSuccess: () => setOpen(false),
  });
  const errors = state.fieldErrors ?? {};
  const id = assessment?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {assessment ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa ${assessment.title}`}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            Tạo bài kiểm tra
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {assessment ? "Sửa bài kiểm tra" : "Tạo bài kiểm tra"}
          </DialogTitle>
          <DialogDescription>
            Lưu form không công bố kết quả cho học viên. Công bố là một hành động
            riêng ở màn nhập điểm.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="class_id" value={classId} />
          {assessment && (
            <input type="hidden" name="id" value={assessment.id} />
          )}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`assessment-title-${id}`}>Tên bài kiểm tra *</Label>
            <Input
              id={`assessment-title-${id}`}
              name="title"
              required
              defaultValue={assessment?.title ?? ""}
              placeholder="Kiểm tra giữa kỳ HSK 2"
            />
            <FieldError message={errors["title"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`assessment-type-${id}`}>Loại *</Label>
              <Select name="type" defaultValue={assessment?.type ?? "quiz"}>
                <SelectTrigger id={`assessment-type-${id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["type"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`assessment-date-${id}`}>Ngày kiểm tra</Label>
              <Input
                id={`assessment-date-${id}`}
                name="assessment_date"
                type="date"
                defaultValue={toDateInputValue(assessment?.assessment_date)}
              />
              <FieldError message={errors["assessment_date"]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`assessment-max-${id}`}>Điểm tối đa *</Label>
              <Input
                id={`assessment-max-${id}`}
                name="max_score"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                defaultValue={assessment?.max_score ?? 100}
              />
              <FieldError message={errors["max_score"]} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`assessment-lesson-${id}`}>Gắn bài học</Label>
            <Select
              name="lesson_id"
              defaultValue={assessment?.lesson_id ?? "none"}
            >
              <SelectTrigger id={`assessment-lesson-${id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không gắn bài học</SelectItem>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors["lesson_id"]} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>
              {assessment ? "Lưu thay đổi" : "Tạo bài kiểm tra"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ assessment }: { assessment: Assessment }) {
  const { formAction } = useFormAction(deleteAssessmentAction, {
    toastError: true,
  });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Xóa bài kiểm tra “${assessment.title}” và toàn bộ điểm đã nhập?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assessment.id} />
      <input type="hidden" name="class_id" value={assessment.class_id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Xóa ${assessment.title}`}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}
