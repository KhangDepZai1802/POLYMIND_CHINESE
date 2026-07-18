"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/shared/confirmation-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSessionLogAction } from "@/features/sessions/server/actions";
import { useFormAction } from "@/lib/use-form-action";

type LessonOption = {
  id: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
};

export function SessionLogForm({
  session,
  lessons,
}: {
  session: {
    id: string;
    lessonId: string | null;
    lessonLog: string | null;
    teacherNote: string | null;
  };
  lessons: LessonOption[];
}) {
  const router = useRouter();
  const { state, formAction } = useFormAction(saveSessionLogAction, {
    onSuccess: () => router.refresh(),
  });
  const fieldErrors = state.fieldErrors ?? {};

  const modules = new Map<string, { title: string; lessons: LessonOption[] }>();
  for (const lesson of lessons) {
    const current = modules.get(lesson.moduleId) ?? {
      title: lesson.moduleTitle,
      lessons: [],
    };
    current.lessons.push(lesson);
    modules.set(lesson.moduleId, current);
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="session_id" value={session.id} />

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="lesson_id">Bài học đã dạy *</Label>
        {lessons.length === 0 ? (
          <Alert>
            <AlertCircle className="size-4" aria-hidden />
            <AlertDescription>
              Khóa học chưa có bài học. Quản trị viên cần bổ sung giáo trình
              trước khi giáo viên hoàn tất buổi.
            </AlertDescription>
          </Alert>
        ) : (
          <Select
            name="lesson_id"
            defaultValue={session.lessonId ?? lessons[0]?.id}
          >
            <SelectTrigger id="lesson_id" className="w-full">
              <SelectValue placeholder="Chọn bài học" />
            </SelectTrigger>
            <SelectContent>
              {[...modules.entries()].map(([moduleId, module]) => (
                <SelectGroup key={moduleId}>
                  <SelectLabel>{module.title}</SelectLabel>
                  {module.lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
        <FieldError message={fieldErrors["lesson_id"]} />
        <p className="text-muted-foreground text-xs">
          Khi hoàn tất, bài học này được đánh dấu hoàn thành cho các lượt ghi
          danh đang mở của lớp. Chuyên cần vẫn được tính riêng từ điểm danh.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lesson_log">Nội dung thực dạy *</Label>
        <Textarea
          id="lesson_log"
          name="lesson_log"
          rows={7}
          required
          maxLength={5000}
          defaultValue={session.lessonLog ?? ""}
          placeholder="Ví dụ: Ôn từ vựng bài 3; luyện hội thoại mở tài khoản; hoàn thành trang 24–29…"
        />
        <FieldError message={fieldErrors["lesson_log"]} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="teacher_note">Ghi chú nội bộ</Label>
        <Textarea
          id="teacher_note"
          name="teacher_note"
          rows={3}
          maxLength={2000}
          defaultValue={session.teacherNote ?? ""}
          placeholder="Điểm cần lưu ý cho buổi sau (học viên không nhìn thấy ghi chú này)"
        />
        <FieldError message={fieldErrors["teacher_note"]} />
      </div>

      <SessionSubmitActions disabled={lessons.length === 0} />
    </form>
  );
}

function SessionSubmitActions({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const confirm = useConfirmation();

  return (
    <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
      <Button
        type="submit"
        name="intent"
        value="draft"
        variant="outline"
        disabled={pending || disabled}
        className="h-11"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save />
        )}
        Lưu nhật ký
      </Button>
      <Button
        type="submit"
        name="intent"
        value="complete"
        disabled={pending || disabled}
        className="h-11"
        onClick={async (event) => {
          event.preventDefault();
          const button = event.currentTarget;
          const accepted = await confirm({
            title: "Hoàn tất buổi học?",
            description:
              "Nhật ký sẽ bị khóa và tiến độ học viên được cập nhật sau thao tác này.",
            confirmLabel: "Hoàn tất buổi",
          });
          if (accepted) button.form?.requestSubmit(button);
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 />
        )}
        Hoàn tất buổi
      </Button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}
