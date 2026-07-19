"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";

import {
  createQuestionSetSectionAction,
  createQuestionSetAction,
  deleteQuestionSetAction,
  lockQuestionSetAction,
  moveQuestionSetItemAction,
  removeQuestionSetItemAction,
  unlockQuestionSetForEditAction,
} from "@/features/question-builder/server/actions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import {
  QuestionPicker,
  type PickerQuestion,
} from "@/features/question-builder/components/question-picker";
import { SubmitButton } from "@/components/shared/submit-button";
import { useConfirmation } from "@/components/shared/confirmation-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/lib/use-form-action";
import type { QuestionType } from "@/features/question-builder/domain/questions";

type SetRecord = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  current_version: {
    id: string;
    version_no: number;
    raw_max_score: number;
    locked_at: string | null;
    question_set_items: Array<{
      id: string;
      section_id: string | null;
      points: number;
      order_index: number;
      question_version: {
        id: string;
        question_id: string;
        question_type: QuestionType;
        prompt_text: string;
        prompt_content: unknown;
        question_options: Array<{
          id: string;
          option_key: string;
          content: string;
          order_index: number;
        }>;
      } | null;
    }>;
    question_set_sections: Array<{
      id: string;
      title: string;
      instructions: string | null;
      order_index: number;
    }>;
  } | null;
};
type QuestionOption = PickerQuestion;

function promptContentOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SetManager({
  kind,
  sets,
  questions,
}: {
  kind: "exercise" | "exam";
  sets: SetRecord[];
  questions: QuestionOption[];
}) {
  const create = useFormAction(createQuestionSetAction);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tạo bộ {kind === "exercise" ? "bài tập" : "đề thi"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={create.formAction}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="kind" value={kind} />
            <div className="space-y-2">
              <Label htmlFor={`${kind}-set-title`}>Tên bộ</Label>
              <Input id={`${kind}-set-title`} name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-set-description`}>Mô tả</Label>
              <Input id={`${kind}-set-description`} name="description" />
            </div>
            <SubmitButton>Tạo bộ</SubmitButton>
          </form>
        </CardContent>
      </Card>
      {sets.length === 0 ? (
        <p className="text-muted-foreground text-center">Chưa có bộ nào.</p>
      ) : (
        sets.map((set) => (
          <SetCard key={set.id} set={set} questions={questions} />
        ))
      )}
    </div>
  );
}

function SetCard({
  set,
  questions,
}: {
  set: SetRecord;
  questions: QuestionOption[];
}) {
  const addSection = useFormAction(createQuestionSetSectionAction);
  const lock = useFormAction(lockQuestionSetAction);
  const unlockEdit = useFormAction(unlockQuestionSetForEditAction, {
    toastError: true,
  });
  const remove = useFormAction(deleteQuestionSetAction, { toastError: true });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const confirm = useConfirmation();
  const version = set.current_version;
  const sectionCount = version?.question_set_sections.length ?? 0;
  const selectedQuestionIds = (version?.question_set_items ?? [])
    .map((item) => item.question_version?.question_id)
    .filter((id): id is string => Boolean(id));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{set.title}</CardTitle>
            <p className="text-muted-foreground text-sm">
              Bản {version?.version_no ?? "—"} ·{" "}
              {version?.question_set_items.length ?? 0} câu ·{" "}
              {version?.raw_max_score ?? 0} điểm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-4" aria-hidden />
              Preview
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Xóa bộ ${set.title}`}
              onClick={async () => {
                const accepted = await confirm({
                  title: `Xóa bộ “${set.title}”?`,
                  description:
                    "Nếu bộ đã từng được giao, hệ thống sẽ lưu trữ thay vì xóa hẳn để giữ lịch sử.",
                  confirmLabel: "Xóa bộ",
                  variant: "destructive",
                });
                if (!accepted) return;
                const data = new FormData();
                data.set("question_set_id", set.id);
                await remove.formAction(data);
              }}
            >
              <Trash2 className="text-destructive size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Preview · {set.title}</DialogTitle>
              <DialogDescription>
                Toàn bộ đề học viên sẽ nhìn thấy · {version?.raw_max_score ?? 0}{" "}
                điểm
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
              {version?.question_set_items.length ? (
                [...version.question_set_items]
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((item, index) => (
                    <section key={item.id} className="rounded-xl border p-4">
                      <p className="mb-3 text-sm font-semibold">
                        Câu {index + 1} · {item.points} điểm
                      </p>
                      {item.question_version && (
                        <QuestionRenderer
                          type={item.question_version.question_type}
                          prompt={item.question_version.prompt_text}
                          promptContent={promptContentOf(
                            item.question_version.prompt_content,
                          )}
                          options={item.question_version.question_options}
                          disabled
                        />
                      )}
                    </section>
                  ))
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Bộ này chưa có câu hỏi để preview.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {!version?.locked_at && version && (
          <div className="space-y-3">
            <QuestionPicker
              setVersionId={version.id}
              sections={[...version.question_set_sections]
                .sort((a, b) => a.order_index - b.order_index)
                .map((section) => ({ id: section.id, title: section.title }))}
              questions={questions}
              selectedQuestionIds={selectedQuestionIds}
            />
            {/* Chia section là tùy chọn — ẩn form đi cho gọn, chỉ mở khi cần
                (đa số bài không cần section). */}
            {showSectionForm ? (
              <form
                action={addSection.formAction}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <input type="hidden" name="set_version_id" value={version.id} />
                <div className="space-y-2">
                  <Label htmlFor={`section-title-${version.id}`}>
                    Tên section
                  </Label>
                  <Input
                    id={`section-title-${version.id}`}
                    name="title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`section-instructions-${version.id}`}>
                    Hướng dẫn
                  </Label>
                  <Input
                    id={`section-instructions-${version.id}`}
                    name="instructions"
                  />
                </div>
                <SubmitButton variant="outline">Thêm section</SubmitButton>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowSectionForm(true)}
              >
                <Plus /> Chia section (tùy chọn)
                {sectionCount > 0 ? ` · đã có ${sectionCount}` : ""}
              </Button>
            )}
          </div>
        )}
        {version &&
          !version.locked_at &&
          version.question_set_items.length > 0 && (
            <div className="space-y-2">
              {[...version.question_set_items]
                .sort((a, b) => a.order_index - b.order_index)
                .map((item, index) => (
                  <SetItemControls
                    key={item.id}
                    itemId={item.id}
                    label={`Câu ${index + 1}`}
                    first={index === 0}
                    last={index === version.question_set_items.length - 1}
                  />
                ))}
            </div>
          )}
        {version && !version.locked_at && (
          <form action={lock.formAction}>
            <input type="hidden" name="set_version_id" value={version.id} />
            <SubmitButton variant="outline">
              Kiểm tra & khóa bộ (sẵn sàng giao)
            </SubmitButton>
          </form>
        )}
        {version?.locked_at && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-emerald-700">
              Bộ đã khóa, sẵn sàng để giao.
            </p>
            {/* Mở khóa để sửa TẠI CHỖ chính bộ này (không đẻ bản mới). Chặn nếu
                đã có học viên làm bài — xem migration 59. */}
            <form action={unlockEdit.formAction}>
              <input type="hidden" name="question_set_id" value={set.id} />
              <SubmitButton variant="outline">
                <Pencil className="size-4" aria-hidden />
                Chỉnh sửa
              </SubmitButton>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SetItemControls({
  itemId,
  label,
  first,
  last,
}: {
  itemId: string;
  label: string;
  first: boolean;
  last: boolean;
}) {
  const move = useFormAction(moveQuestionSetItemAction);
  const remove = useFormAction(removeQuestionSetItemAction);
  return (
    <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
      <span className="flex-1">{label}</span>
      <form action={move.formAction}>
        <input type="hidden" name="item_id" value={itemId} />
        <Button
          type="submit"
          name="direction"
          value="-1"
          size="sm"
          variant="ghost"
          disabled={first}
        >
          ↑
        </Button>
        <Button
          type="submit"
          name="direction"
          value="1"
          size="sm"
          variant="ghost"
          disabled={last}
        >
          ↓
        </Button>
      </form>
      <form action={remove.formAction}>
        <input type="hidden" name="item_id" value={itemId} />
        <Button type="submit" size="sm" variant="destructive">
          Xóa
        </Button>
      </form>
    </div>
  );
}
