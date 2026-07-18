"use client";

import { useState } from "react";
import { MoreHorizontal, Send, Share2 } from "lucide-react";

import {
  cloneQuestionAction,
  shareQuestionAction,
  submitQuestionReviewAction,
} from "@/features/question-bank/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormAction } from "@/lib/use-form-action";

/**
 * Thao tác trên một câu hỏi — gom vào menu kebab để card gọn.
 * (Đã bỏ nút "Lưu trữ" theo yêu cầu; action archive vẫn còn ở server nhưng
 * không mở từ đây.)
 */
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
  const share = useFormAction(shareQuestionAction, { toastError: true });
  const clone = useFormAction(cloneQuestionAction, { toastError: true });
  const review = useFormAction(submitQuestionReviewAction, { toastError: true });
  const [shareOpen, setShareOpen] = useState(false);

  if (!isOwner) {
    return (
      <form action={clone.formAction}>
        <input type="hidden" name="question_id" value={questionId} />
        <SubmitButton size="sm" variant="outline">
          Sao chép về của tôi
        </SubmitButton>
      </form>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label="Thao tác câu hỏi">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Share2 />
            Chia sẻ với giáo viên…
          </DropdownMenuItem>
          {visibility === "private" && (
            <DropdownMenuItem
              onSelect={() => {
                const fd = new FormData();
                fd.set("question_id", questionId);
                void review.formAction(fd);
              }}
            >
              <Send />
              Gửi duyệt kho chung
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chia sẻ câu hỏi</DialogTitle>
            <DialogDescription>
              Chọn giáo viên để chia sẻ câu hỏi này. Họ sẽ thấy câu trong ngân
              hàng của mình.
            </DialogDescription>
          </DialogHeader>
          <form
            action={async (fd) => {
              await share.formAction(fd);
              setShareOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="question_id" value={questionId} />
            <Select name="teacher_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Chọn giáo viên…" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.teacher_code} — {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <SubmitButton>Chia sẻ</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
