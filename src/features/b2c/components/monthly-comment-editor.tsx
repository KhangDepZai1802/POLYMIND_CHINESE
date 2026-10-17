"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MONTHLY_COMMENT_FIELDS, type MonthlyCommentStudent } from "../domain/monthly-comments";
import { saveMonthlyCommentAction } from "../server/monthly-comment-actions";

export function MonthlyCommentEditor({ classId, month, student, onClose, onSaved }: { classId: string; month: string; student: MonthlyCommentStudent; onClose: () => void; onSaved: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID()), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Nhận xét tháng · {student.full_name}</DialogTitle><DialogDescription>Tháng {month.split("-").reverse().join("/")} · Mẫu nhận xét gồm sáu mục; không tự tạo nội dung thay giáo viên.</DialogDescription></DialogHeader>
    <form onSubmit={async (event) => {
      event.preventDefault(); const f = new FormData(event.currentTarget);
      const status = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "ready" ? "ready" : "draft";
      setBusy(true); setError("");
      try {
        const r = await saveMonthlyCommentAction({ request_id: requestId, class_id: classId, enrollment_id: student.enrollment_id, month, expected_updated_at: student.report?.updated_at ?? null, status, content: Object.fromEntries(Object.keys(MONTHLY_COMMENT_FIELDS).map((key) => [key, f.get(key)])) });
        if (r.error) setError(r.error); else onSaved();
      } catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-4">
      {Object.entries(MONTHLY_COMMENT_FIELDS).map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<Textarea name={key} maxLength={1000} rows={3} defaultValue={student.report?.content[key as keyof typeof MONTHLY_COMMENT_FIELDS] ?? ""} /></label>)}
      <p className="text-muted-foreground text-xs">Bản nháp có thể chưa đủ nội dung. Bản hoàn tất cần đủ sáu mục và mới được chuẩn bị gửi phụ huynh. Sửa sau khi gửi sẽ tạo phiên bản mới; lần gửi cũ giữ nguyên nội dung.</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" value="draft">{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button><Button type="submit" value="ready">Hoàn tất nhận xét</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
