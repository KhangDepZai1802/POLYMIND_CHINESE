"use client";

import { useState } from "react";

import { createQuestionAction } from "@/features/question-bank/server/actions";
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
} from "@/features/question-builder/domain/questions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";

export function QuestionForm() {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(createQuestionAction, {
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tạo câu hỏi</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo câu hỏi</DialogTitle>
          <DialogDescription>
            Editor dùng chung cho đủ 11 dạng câu. Đáp án được lưu riêng và không
            gửi cho học viên.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publish" value="true" />
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="question-title">Tiêu đề nội bộ</Label>
              <Input id="question-title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-type">Dạng câu</Label>
              <Select name="question_type" defaultValue="single_choice">
                <SelectTrigger id="question-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {QUESTION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-skill">Kỹ năng</Label>
              <Select name="skill" defaultValue="reading">
                <SelectTrigger id="question-skill">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([
                    ["listening", "Nghe"],
                    ["speaking", "Nói"],
                    ["reading", "Đọc"],
                    ["writing", "Viết"],
                    ["vocabulary", "Từ vựng"],
                    ["grammar", "Ngữ pháp"],
                  ] as const).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-difficulty">Độ khó</Label>
              <Select name="difficulty" defaultValue="medium">
                <SelectTrigger id="question-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Dễ</SelectItem>
                  <SelectItem value="medium">Vừa</SelectItem>
                  <SelectItem value="hard">Khó</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-text">Nội dung câu hỏi</Label>
            <Textarea id="prompt-text" name="prompt_text" rows={4} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="options-text">
              Lựa chọn / token / cặp (mỗi dòng một mục)
            </Label>
            <Textarea
              id="options-text"
              name="options_text"
              rows={4}
              placeholder={"你好\n再见\n谢谢"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="answer-text">
              Đáp án chấm (key hoặc đáp án chấp nhận, cách nhau bằng dòng/dấu
              phẩy)
            </Label>
            <Textarea
              id="answer-text"
              name="answer_text"
              rows={3}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="explanation-text">Giải thích sau công bố</Label>
            <Textarea id="explanation-text" name="explanation_text" rows={2} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton pendingText="Đang lưu…">Lưu & sẵn sàng</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
