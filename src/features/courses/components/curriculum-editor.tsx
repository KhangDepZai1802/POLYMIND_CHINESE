"use client";

import { useState } from "react";
import { BookMarked, Clock, Plus, Trash2 } from "lucide-react";

import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
} from "@/features/courses/server/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

type Lesson = {
  id: string;
  title: string;
  objectives: string | null;
  planned_duration_minutes: number | null;
  order_index: number;
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons: Lesson[];
};

export function CurriculumEditor({
  courseId,
  modules,
}: {
  courseId: string;
  modules: Module[];
}) {
  const nextModuleOrder =
    modules.reduce((max, m) => Math.max(max, m.order_index), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Giáo trình</h2>
          <p className="text-muted-foreground text-sm">
            Chương → bài học. Buổi học trong lớp sẽ gắn với các bài học này.
          </p>
        </div>
        <ModuleDialog courseId={courseId} nextOrder={nextModuleOrder} />
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BookMarked}
              title="Chưa có chương nào"
              description="Thêm chương đầu tiên, rồi thêm bài học vào trong chương."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleCard key={m.id} courseId={courseId} module={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  courseId,
  module,
}: {
  courseId: string;
  module: Module;
}) {
  const nextLessonOrder =
    module.lessons.reduce((max, l) => Math.max(max, l.order_index), 0) + 1;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded text-xs font-semibold">
                {module.order_index}
              </span>
              <h3 className="truncate font-medium">{module.title}</h3>
            </div>
            {module.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {module.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <LessonDialog
              courseId={courseId}
              moduleId={module.id}
              moduleTitle={module.title}
              nextOrder={nextLessonOrder}
            />
            <DeleteButton
              action={deleteModuleAction}
              id={module.id}
              courseId={courseId}
              label={`Xóa chương "${module.title}"`}
              confirmMessage={`Xóa chương "${module.title}"? Toàn bộ ${module.lessons.length} bài học bên trong cũng bị xóa.`}
            />
          </div>
        </div>

        {module.lessons.length > 0 && (
          <ul className="mt-3 space-y-1 border-t pt-3">
            {module.lessons.map((l) => (
              <li
                key={l.id}
                className="hover:bg-muted/50 group flex items-center gap-3 rounded px-2 py-1.5"
              >
                <span className="text-muted-foreground w-6 shrink-0 text-right text-xs">
                  {l.order_index}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  {l.objectives && (
                    <p className="text-muted-foreground truncate text-xs">
                      {l.objectives}
                    </p>
                  )}
                </div>
                {l.planned_duration_minutes && (
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                    <Clock className="size-3" aria-hidden />
                    {l.planned_duration_minutes}′
                  </span>
                )}
                <DeleteButton
                  action={deleteLessonAction}
                  id={l.id}
                  courseId={courseId}
                  label={`Xóa bài "${l.title}"`}
                  confirmMessage={`Xóa bài học "${l.title}"?`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ModuleDialog({
  courseId,
  nextOrder,
}: {
  courseId: string;
  nextOrder: number;
}) {
  const [open, setOpen] = useState(false);
  const { formAction } = useFormAction(createModuleAction, {
    onSuccess: () => setOpen(false),
    toastError: true,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" aria-hidden />
          Thêm chương
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm chương</DialogTitle>
          <DialogDescription>
            Chương là nhóm các bài học có liên quan.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="course_id" value={courseId} />

          <div className="space-y-2">
            <Label htmlFor="module_title">Tên chương *</Label>
            <Input
              id="module_title"
              name="title"
              required
              placeholder="Chương 1: Chào hỏi & Giới thiệu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module_description">Mô tả</Label>
            <Textarea id="module_description" name="description" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module_order">Thứ tự *</Label>
            <Input
              id="module_order"
              name="order_index"
              type="number"
              min={1}
              required
              defaultValue={nextOrder}
              className="w-28"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Thêm chương</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonDialog({
  courseId,
  moduleId,
  moduleTitle,
  nextOrder,
}: {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  nextOrder: number;
}) {
  const [open, setOpen] = useState(false);
  const { formAction } = useFormAction(createLessonAction, {
    onSuccess: () => setOpen(false),
    toastError: true,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="size-4" aria-hidden />
          Bài học
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bài học</DialogTitle>
          <DialogDescription>Vào chương: {moduleTitle}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="module_id" value={moduleId} />
          <input type="hidden" name="course_id" value={courseId} />

          <div className="space-y-2">
            <Label htmlFor="lesson_title">Tên bài học *</Label>
            <Input
              id="lesson_title"
              name="title"
              required
              placeholder="Bài 1: 你好！"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson_objectives">Mục tiêu</Label>
            <Textarea id="lesson_objectives" name="objectives" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson_duration">Thời lượng (phút)</Label>
              <Input
                id="lesson_duration"
                name="planned_duration_minutes"
                type="number"
                min={1}
                placeholder="90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lesson_order">Thứ tự *</Label>
              <Input
                id="lesson_order"
                name="order_index"
                type="number"
                min={1}
                required
                defaultValue={nextOrder}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Thêm bài học</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nút xóa có xác nhận.
 *
 * `confirm()` chặn luồng nên không bị race với submit — đủ cho thao tác xóa
 * trong giáo trình. Các mutation nặng hơn (rút học, chuyển lớp) dùng dialog riêng.
 */
function DeleteButton({
  action,
  id,
  courseId,
  label,
  confirmMessage,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  courseId: string;
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  const { formAction } = useFormAction(action, { toastError: true });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="course_id" value={courseId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={label}
        className={className}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}
