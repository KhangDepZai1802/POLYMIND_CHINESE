"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NPS_QUESTION } from "../domain/nps";
import { submitPublicNpsAction } from "../server/nps-public-actions";

export function NpsParentForm({ token }: { token: string }) {
  const [requestId] = useState(() => crypto.randomUUID()), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  if (sent) return <div role="status" className="rounded-xl bg-emerald-50 p-5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><h2 className="text-xl font-semibold">Cảm ơn Quý phụ huynh!</h2><p className="mt-2">Phản hồi đã được ghi nhận để trung tâm cải thiện chất lượng giảng dạy và chăm sóc học viên.</p></div>;
  return <form className="space-y-6" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; const f = new FormData(event.currentTarget); f.set("token", token); f.set("request_id", requestId); setBusy(true); setError("");
    try { const r = await submitPublicNpsAction(f); if (r.error) setError(r.error); else setSent(true); }
    catch { setError("Không kết nối được. Vui lòng thử lại; nội dung của anh/chị vẫn được giữ."); } finally { setBusy(false); }
  }}><fieldset disabled={busy} className="space-y-6">
    <fieldset><legend className="text-lg font-semibold">{NPS_QUESTION}</legend><p className="text-muted-foreground mt-2 text-sm">0 = Hoàn toàn không sẵn lòng · 10 = Rất sẵn lòng</p><div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-11">{Array.from({ length: 11 }, (_, score) => <label key={score} className="relative cursor-pointer"><input type="radio" name="score" value={score} required className="peer sr-only" aria-label={`${score} điểm`} /><span className="peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring flex min-h-11 items-center justify-center rounded-lg border text-base font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2">{score}</span></label>)}</div></fieldset>
    <label className="grid gap-2 text-sm font-medium">Lý do chấm điểm / Góp ý<Textarea name="reason" rows={3} maxLength={2000} placeholder="Điều anh/chị hài lòng hoặc mong trung tâm cải thiện…" /></label>
    <label className="grid gap-2 text-sm font-medium">Góp ý về giáo viên (nếu có)<Textarea name="teacher_feedback" rows={3} maxLength={2000} /></label>
    <label className="grid gap-2 text-sm font-medium">Góp ý về chăm sóc phụ huynh (nếu có)<Textarea name="service_feedback" rows={3} maxLength={2000} /></label>
    <p className="text-muted-foreground text-xs">Phản hồi gắn với đường dẫn riêng được cấp cho phụ huynh và chỉ quản lý trung tâm xem được. Mỗi phụ huynh gửi một lần cho khóa học này.</p>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}<Button type="submit" className="w-full sm:w-auto">{busy ? "Đang gửi…" : "Gửi phản hồi"}</Button>
  </fieldset></form>;
}
