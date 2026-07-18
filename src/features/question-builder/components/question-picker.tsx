"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { addQuestionSetItemsAction } from "@/features/question-builder/server/actions";
import {
  QUESTION_SKILL_LABELS,
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from "@/features/question-builder/domain/questions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/lib/use-form-action";

export type PickerQuestion = {
  id: string;
  code: string | null;
  title: string;
  skill: string;
  current_version: {
    id: string;
    question_type: QuestionType;
    prompt_text: string;
  } | null;
};

/**
 * Bảng chọn câu hỏi có tìm kiếm + lọc kỹ năng + tick nhiều câu, thay cho
 * dropdown đổ toàn bộ câu hỏi (không dùng được khi ngân hàng có hàng nghìn câu).
 * Lọc phía client trên danh sách đã tải — đủ dùng cho quy mô hiện tại.
 */
export function QuestionPicker({
  setVersionId,
  sections,
  questions,
}: {
  setVersionId: string;
  sections: Array<{ id: string; title: string }>;
  questions: PickerQuestion[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const form = useFormAction(addQuestionSetItemsAction, {
    toastError: true,
    onSuccess: () => {
      setOpen(false);
      setSelected(new Set());
      setQuery("");
      setSkill("");
    },
  });

  const ready = useMemo(
    () => questions.filter((q) => q.current_version),
    [questions],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ready.filter((q) => {
      if (skill && q.skill !== skill) return false;
      if (!needle) return true;
      return (
        q.title.toLowerCase().includes(needle) ||
        (q.code ?? "").toLowerCase().includes(needle)
      );
    });
  }, [ready, query, skill]);

  function toggle(versionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected(new Set());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Thêm câu hỏi
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm câu hỏi vào bộ</DialogTitle>
          <DialogDescription>
            Tìm theo mã hoặc tiêu đề, lọc theo kỹ năng, rồi tick chọn các câu bạn
            muốn thêm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã hoặc tiêu đề…"
              className="pl-9"
            />
          </div>
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="bg-background h-11 rounded-md border px-3 text-sm"
          >
            <option value="">Mọi kỹ năng</option>
            {Object.entries(QUESTION_SKILL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Không tìm thấy câu hỏi phù hợp.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((q) => {
                const versionId = q.current_version!.id;
                const checked = selected.has(versionId);
                return (
                  <li key={q.id}>
                    <label className="hover:bg-accent/50 flex cursor-pointer items-start gap-3 p-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(versionId)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {q.code && (
                            <code className="text-muted-foreground text-xs">
                              {q.code}
                            </code>
                          )}
                          <span className="truncate font-medium">{q.title}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                          {q.current_version!.prompt_text}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-normal">
                        {QUESTION_TYPE_LABELS[q.current_version!.question_type]}
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form
          action={form.formAction}
          className="flex flex-wrap items-end justify-between gap-3 border-t pt-4"
        >
          <input type="hidden" name="set_version_id" value={setVersionId} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="question_version_ids" value={id} />
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={`picker-points-${setVersionId}`}>Điểm mỗi câu</Label>
              <Input
                id={`picker-points-${setVersionId}`}
                name="points"
                type="number"
                min="0.25"
                step="0.25"
                defaultValue="1"
                className="w-28"
                required
              />
            </div>
            {sections.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor={`picker-section-${setVersionId}`}>Section</Label>
                <select
                  id={`picker-section-${setVersionId}`}
                  name="section_id"
                  className="bg-background h-11 rounded-md border px-3 text-sm"
                >
                  <option value="">Không section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <SubmitButton disabled={selected.size === 0}>
            Thêm {selected.size > 0 ? `${selected.size} câu` : "câu"} đã chọn
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
