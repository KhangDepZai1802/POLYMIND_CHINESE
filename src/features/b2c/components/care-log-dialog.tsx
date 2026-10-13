"use client";
import { useState, useTransition } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { saveB2CCareLogAction, getB2CCareLogsAction } from "@/features/b2c/server/actions";
import { useFormAction } from "@/lib/use-form-action";

type CareLog = { id: string; channel: string; contact_date: string; caretaker_name: string; content: string; next_followup_date: string | null };
const dateLabel = (value: string) => value.split("-").reverse().join("/");
export function CareLogDialog({ leadId, fullName, caretaker }: { leadId: string; fullName: string; caretaker: string }) {
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  function load(next: number) {
    setError("");
    startTransition(async () => {
      try { const result = await getB2CCareLogsAction(leadId, next); if (result.error) { setError(result.error); return; } setLogs(result.logs); setTotal(result.total); setPage(next); }
      catch { setError("Không tải được nhật ký. Vui lòng thử lại."); }
    });
  }
  const { state, formAction } = useFormAction(saveB2CCareLogAction, { onSuccess: () => { setFormKey((value) => value + 1); load(0); } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <Dialog onOpenChange={(open) => { if (open) { setLogs([]); load(0); setFormKey((value) => value + 1); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="mt-3 w-full"><History className="size-4" aria-hidden />Nhật ký chăm sóc</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Nhật ký chăm sóc</DialogTitle><DialogDescription>{fullName} · {total} lần liên hệ</DialogDescription></DialogHeader>
      <form key={formKey} action={formAction} className="space-y-3 rounded-lg border p-4">
        <input type="hidden" name="lead_id" value={leadId} />
        <h3 className="font-medium">Thêm lần chăm sóc</h3>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor={`channel-${leadId}`}>Hình thức</Label><select id={`channel-${leadId}`} name="channel" className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"><option value="call">Gọi điện</option><option value="message">Nhắn tin</option></select></div><div className="space-y-2"><Label htmlFor={`contact-${leadId}`}>Ngày liên hệ *</Label><Input id={`contact-${leadId}`} name="contact_date" type="date" required defaultValue={today} /></div></div>
        <div className="space-y-2"><Label htmlFor={`caretaker-${leadId}`}>Người phụ trách *</Label><Input id={`caretaker-${leadId}`} name="caretaker_name" required maxLength={200} defaultValue={caretaker} /></div>
        <div className="space-y-2"><Label htmlFor={`content-${leadId}`}>Nội dung trao đổi với khách/phụ huynh *</Label><Textarea id={`content-${leadId}`} name="content" required maxLength={2000} rows={3} /></div>
        <div className="space-y-2"><Label htmlFor={`next-${leadId}`}>Ngày hẹn tiếp theo</Label><Input id={`next-${leadId}`} name="next_followup_date" type="date" /></div>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        {state.fieldErrors && <p role="alert" className="text-destructive text-sm">{Object.values(state.fieldErrors).flat().join(" ")}</p>}
        <SubmitButton>Lưu nhật ký</SubmitButton>
      </form>
      <h3 className="font-medium">Lịch sử chăm sóc</h3>
      {pending ? <p role="status">Đang tải…</p> : error ? <div role="alert"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => load(page)}>Thử lại</Button></div> : logs.length === 0 ? <p className="text-muted-foreground text-sm">Chưa có nhật ký chăm sóc.</p> : <div className="space-y-3">{logs.map((log) => <article key={log.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{log.channel === "call" ? "Gọi điện" : "Nhắn tin"} · {dateLabel(log.contact_date)} · {log.caretaker_name}</p><p className="mt-2 text-sm whitespace-pre-wrap break-words">{log.content}</p>{log.next_followup_date && <p className="text-primary mt-2 text-sm">Hẹn tiếp: {dateLabel(log.next_followup_date)}</p>}</article>)}</div>}
      {!error && total > 20 && <div className="flex items-center justify-between"><Button variant="outline" disabled={pending || page === 0} onClick={() => load(page - 1)}>Trước</Button><span className="text-sm">Trang {page + 1}/{Math.ceil(total / 20)}</span><Button variant="outline" disabled={pending || (page + 1) * 20 >= total} onClick={() => load(page + 1)}>Sau</Button></div>}
    </DialogContent>
  </Dialog>;
}
