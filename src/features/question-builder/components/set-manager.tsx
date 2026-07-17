"use client";

import { useState } from "react";

import {
  addQuestionSetItemAction,
  createQuestionSetSectionAction,
  createQuestionSetAction,
  lockQuestionSetAction,
  moveQuestionSetItemAction,
  removeQuestionSetItemAction,
} from "@/features/question-builder/server/actions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import { QUESTION_TYPE_LABELS } from "@/features/question-builder/domain/questions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        question_type: QuestionType;
        prompt_text: string;
        question_options: Array<{
          id: string;
          option_key: string;
          content: string;
          order_index: number;
        }>;
      } | null;
    }>;
    question_set_sections: Array<{ id: string; title: string; instructions: string | null; order_index: number }>;
  } | null;
};
type QuestionOption = {
  id: string;
  title: string;
  current_version: {
    id: string;
    question_type: QuestionType;
    prompt_text: string;
  } | null;
};

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
  const add = useFormAction(addQuestionSetItemAction);
  const addSection = useFormAction(createQuestionSetSectionAction);
  const lock = useFormAction(lockQuestionSetAction);
  const [preview, setPreview] = useState(false);
  const version = set.current_version;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{set.title}</CardTitle>
            <p className="text-muted-foreground text-sm">
              Version {version?.version_no ?? "—"} ·{" "}
              {version?.question_set_items.length ?? 0} câu ·{" "}
              {version?.raw_max_score ?? 0} điểm thô
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? "Đóng preview" : "Preview"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {preview && (
          <div className="space-y-6 rounded-xl border p-4">
            {version?.question_set_items
              .sort((a, b) => a.order_index - b.order_index)
              .map((item, index) => (
                <div key={item.id}>
                  <p className="mb-2 text-sm font-semibold">
                    Câu {index + 1} · {item.points} điểm
                  </p>
                  {item.question_version && (
                    <QuestionRenderer
                      type={item.question_version.question_type}
                      prompt={item.question_version.prompt_text}
                      options={item.question_version.question_options}
                      disabled
                    />
                  )}
                </div>
              ))}
          </div>
        )}
        {!version?.locked_at && version && (
          <form action={addSection.formAction} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="set_version_id" value={version.id} />
            <div className="space-y-2"><Label htmlFor={`section-title-${version.id}`}>Tên section</Label><Input id={`section-title-${version.id}`} name="title" required /></div>
            <div className="space-y-2"><Label htmlFor={`section-instructions-${version.id}`}>Hướng dẫn</Label><Input id={`section-instructions-${version.id}`} name="instructions" /></div>
            <SubmitButton variant="outline">Thêm section</SubmitButton>
          </form>
        )}
        {!version?.locked_at && version && (
          <form
            action={add.formAction}
            className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
          >
            <input type="hidden" name="set_version_id" value={version.id} />
            <div className="space-y-2">
              <Label htmlFor={`question-${version.id}`}>Câu hỏi</Label>
              <Select name="question_version_id" required>
                <SelectTrigger id={`question-${version.id}`}>
                  <SelectValue placeholder="Chọn câu hỏi" />
                </SelectTrigger>
                <SelectContent>
                  {questions
                    .filter((q) => q.current_version)
                    .map((q) => (
                      <SelectItem key={q.id} value={q.current_version!.id}>
                        {q.title} —{" "}
                        {QUESTION_TYPE_LABELS[q.current_version!.question_type]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {version.question_set_sections.length > 0 && <div className="space-y-2"><Label htmlFor={`section-${version.id}`}>Section</Label><Select name="section_id"><SelectTrigger id={`section-${version.id}`}><SelectValue placeholder="Không section" /></SelectTrigger><SelectContent>{[...version.question_set_sections].sort((a,b)=>a.order_index-b.order_index).map((section)=><SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-2">
              <Label htmlFor={`points-${version.id}`}>Điểm</Label>
              <Input
                id={`points-${version.id}`}
                name="points"
                type="number"
                min="0.25"
                step="0.25"
                defaultValue="1"
                required
              />
            </div>
            <SubmitButton>Thêm câu</SubmitButton>
          </form>
        )}
        {version && !version.locked_at && version.question_set_items.length > 0 && <div className="space-y-2">{[...version.question_set_items].sort((a,b)=>a.order_index-b.order_index).map((item,index)=><SetItemControls key={item.id} itemId={item.id} label={`Câu ${index+1}`} first={index===0} last={index===version.question_set_items.length-1} />)}</div>}
        {version && !version.locked_at && (
          <form action={lock.formAction}>
            <input type="hidden" name="set_version_id" value={version.id} />
            <SubmitButton variant="outline">
              Kiểm tra & chốt version
            </SubmitButton>
          </form>
        )}
        {version?.locked_at && (
          <p className="text-sm font-medium text-emerald-700">
            Version đã khóa, sẵn sàng để giao.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SetItemControls({ itemId, label, first, last }: { itemId: string; label: string; first: boolean; last: boolean }) {
  const move=useFormAction(moveQuestionSetItemAction); const remove=useFormAction(removeQuestionSetItemAction);
  return <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><span className="flex-1">{label}</span><form action={move.formAction}><input type="hidden" name="item_id" value={itemId}/><Button type="submit" name="direction" value="-1" size="sm" variant="ghost" disabled={first}>↑</Button><Button type="submit" name="direction" value="1" size="sm" variant="ghost" disabled={last}>↓</Button></form><form action={remove.formAction}><input type="hidden" name="item_id" value={itemId}/><Button type="submit" size="sm" variant="destructive">Xóa</Button></form></div>;
}
