"use client";

import { reviewQuestionAction } from "@/features/question-bank/server/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/use-form-action";

type Request = { id: string; submitted_at: string; question: { code: string; title: string } | null };

export function ReviewQueue({ requests }: { requests: Request[] }) {
  return <div className="space-y-4">{requests.length === 0 ? <p className="text-muted-foreground">Không có câu chờ duyệt.</p> : requests.map((request) => <ReviewItem key={request.id} request={request} />)}</div>;
}

function ReviewItem({ request }: { request: Request }) {
  const form = useFormAction(reviewQuestionAction);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{request.question?.code} — {request.question?.title}</CardTitle></CardHeader>
      <CardContent>
        <form action={form.formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="request_id" value={request.id} />
          <Input name="reason" placeholder="Lý do/ghi chú duyệt" className="max-w-sm" />
          <Button type="submit" name="decision" value="approve">Duyệt</Button>
          <Button type="submit" name="decision" value="reject" variant="destructive">Từ chối</Button>
          {(form.state.error || form.state.success) && <p className="w-full text-sm">{form.state.error ?? form.state.success}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
