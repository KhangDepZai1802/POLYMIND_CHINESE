"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { NpsSurvey } from "../domain/nps";
import { findNpsClassesAction, saveNpsSurveyAction } from "../server/nps-actions";

export function NpsSurveyEditor({ survey, today, onClose, onSaved }: { survey?: NpsSurvey; today: string; onClose: () => void; onSaved: (id: string) => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState(""), [page, setPage] = useState(0), [classes, setClasses] = useState<{ rows: { id: string; code: string; name: string }[]; total: number }>({ rows: [], total: 0 });
  const [classId, setClassId] = useState(survey?.class_id ?? ""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (survey) return;
    let active = true;
    findNpsClassesAction(query, page).then((r) => { if (active) { setClasses(r); setError(""); } }).catch(() => { if (active) setError("Không tải được danh sách lớp."); });
    return () => { active = false; };
  }, [query, page, survey]);
  const defaultDate = survey ? new Date(survey.expires_at).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }) : new Date(Date.parse(today) + 14 * 86400000).toISOString().slice(0, 10);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{survey ? "Cài đặt khảo sát" : "Tạo khảo sát phụ huynh"}</DialogTitle><DialogDescription>Mỗi lớp có một khảo sát. Mở lại hoặc gia hạn giữ nguyên toàn bộ phản hồi.</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget); setBusy(true); setError("");
      try { const r = await saveNpsSurveyAction({ request_id: requestId, id: survey?.id ?? null, class_id: classId, title: f.get("title"), status: f.get("status"), expires_on: f.get("expires"), expected_updated_at: survey?.updated_at ?? null }); if (r.error) setError(r.error); else if (r.id) onSaved(r.id); }
      catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-3">
      {survey ? <p>{survey.class_code} · {survey.class_name}</p> : <>
        <label className="grid gap-1 text-sm">Tìm lớp<Input value={query} maxLength={200} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></label>
        <label className="grid gap-1 text-sm">Lớp<select className="bg-background h-10 rounded border px-2" required value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Chọn lớp</option>{classId && !classes.rows.some((c) => c.id === classId) && <option value={classId}>Lớp đã chọn</option>}{classes.rows.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
        <div className="flex items-center gap-2 text-sm"><Button type="button" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · {classes.total} lớp</span><Button type="button" variant="outline" disabled={(page + 1) * 20 >= classes.total} onClick={() => setPage(page + 1)}>Sau</Button></div>
      </>}
      <label className="grid gap-1 text-sm">Tên khảo sát<Input name="title" required maxLength={200} readOnly={!!survey} defaultValue={survey?.title ?? "Khảo sát hài lòng cuối khóa"} /></label>
      <label className="grid gap-1 text-sm">Trạng thái<select name="status" defaultValue={survey?.status ?? "open"} className="bg-background h-10 rounded border px-2"><option value="open">Mở nhận phản hồi</option><option value="closed">Đóng khảo sát</option></select></label>
      <label className="grid gap-1 text-sm">Hạn trả lời (giờ Việt Nam)<Input type="date" name="expires" required defaultValue={defaultDate} /></label><p className="text-muted-foreground text-xs">Khi mở khảo sát, hạn trả lời phải ở tương lai và trong vòng 90 ngày.</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}<Button type="submit">{busy ? "Đang lưu…" : "Lưu khảo sát"}</Button>
    </fieldset></form>
  </DialogContent></Dialog>;
}
