"use client";

import Link from "next/link";
import { useState } from "react";
import { importQuestionsAction } from "@/features/question-bank/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/lib/use-form-action";

export function QuestionImport() {
  const [open, setOpen] = useState(false);
  const form = useFormAction(importQuestionsAction);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Import Excel</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import câu hỏi từ Excel</DialogTitle>
          <DialogDescription>Luôn dry-run trước. Khi import thật, toàn bộ batch chạy trong một transaction và rollback nếu có lỗi.</DialogDescription>
        </DialogHeader>
        <form action={form.formAction} className="space-y-4">
          <Button asChild variant="link" className="px-0"><Link href="/api/question-import-template">Tải template .xlsx</Link></Button>
          <div className="space-y-2"><Label htmlFor="question-import-file">File .xlsx (tối đa 5 MB)</Label><Input id="question-import-file" name="file" type="file" accept=".xlsx" required /></div>
          {(form.state.error || form.state.success) && <Alert variant={form.state.error ? "destructive" : "default"}><AlertDescription>{form.state.error ?? form.state.success}</AlertDescription></Alert>}
          <div className="flex gap-2">
            <SubmitButton name="mode" value="dry-run" variant="outline">Dry-run</SubmitButton>
            <SubmitButton name="mode" value="import">Import transaction</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
