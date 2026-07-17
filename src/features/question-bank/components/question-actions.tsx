"use client";

import { archiveQuestionAction, cloneQuestionAction, shareQuestionAction, submitQuestionReviewAction } from "@/features/question-bank/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormAction } from "@/lib/use-form-action";

export function QuestionActions({
  questionId,
  isOwner,
  visibility,
  teachers,
}: {
  questionId: string;
  isOwner: boolean;
  visibility: string;
  teachers: Array<{ id: string; teacher_code: string; full_name: string }>;
}) {
  const share = useFormAction(shareQuestionAction);
  const clone = useFormAction(cloneQuestionAction);
  const review = useFormAction(submitQuestionReviewAction);
  const archive = useFormAction(archiveQuestionAction);
  if (!isOwner) {
    return (
      <form action={clone.formAction}>
        <input type="hidden" name="question_id" value={questionId} />
        <SubmitButton size="sm" variant="outline">Clone</SubmitButton>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={share.formAction} className="flex items-center gap-2">
        <input type="hidden" name="question_id" value={questionId} />
        <Select name="teacher_id" required>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Chia sẻ với…" /></SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>{teacher.teacher_code} — {teacher.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SubmitButton size="sm" variant="outline">Chia sẻ</SubmitButton>
      </form>
      {visibility === "private" && (
        <form action={review.formAction}>
          <input type="hidden" name="question_id" value={questionId} />
          <SubmitButton size="sm" variant="outline">Gửi duyệt kho chung</SubmitButton>
        </form>
      )}
      <form action={archive.formAction}><input type="hidden" name="id" value={questionId}/><SubmitButton size="sm" variant="destructive">Lưu trữ</SubmitButton></form>
    </div>
  );
}
