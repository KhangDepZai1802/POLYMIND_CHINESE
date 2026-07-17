"use client";

import { useState } from "react";
import { createQuestionVersionAction } from "@/features/question-bank/server/actions";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionType } from "@/features/question-builder/domain/questions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";

export function QuestionVersionForm({ questionId, title, skill, difficulty, current }: { questionId: string; title: string; skill: string; difficulty: string; current: { question_type: QuestionType; prompt_text: string; explanation_text: string | null; question_options: Array<{ content: string }> } }) {
  const [open,setOpen]=useState(false); const form=useFormAction(createQuestionVersionAction,{onSuccess:()=>setOpen(false)});
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Tạo version mới</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Version mới</DialogTitle><DialogDescription>Không sửa version đã dùng; nội dung này sẽ trở thành current version mới.</DialogDescription></DialogHeader><form action={form.formAction} className="space-y-3">
    <input type="hidden" name="question_id" value={questionId}/><input type="hidden" name="title" value={title}/><input type="hidden" name="skill" value={skill}/><input type="hidden" name="difficulty" value={difficulty}/>
    <div className="space-y-2"><Label>Dạng câu</Label><select name="question_type" defaultValue={current.question_type} className="bg-background h-9 w-full rounded-md border px-3 text-sm">{QUESTION_TYPES.map((type)=><option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}</select></div>
    <div className="space-y-2"><Label>Nội dung</Label><Textarea name="prompt_text" defaultValue={current.prompt_text} required/></div>
    <div className="space-y-2"><Label>Lựa chọn (mỗi dòng)</Label><Textarea name="options_text" defaultValue={current.question_options.map((option)=>option.content).join("\n")}/></div>
    <div className="space-y-2"><Label>Đáp án mới</Label><Textarea name="answer_text" required/></div>
    <div className="space-y-2"><Label>Giải thích</Label><Input name="explanation_text" defaultValue={current.explanation_text ?? ""}/></div>
    {form.state.error&&<p className="text-destructive text-sm">{form.state.error}</p>}<SubmitButton>Lưu version mới</SubmitButton>
  </form></DialogContent></Dialog>;
}
