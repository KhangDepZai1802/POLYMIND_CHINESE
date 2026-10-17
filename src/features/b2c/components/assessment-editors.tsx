"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { B2C_ASSESSMENT_TYPES, type B2CAssessment, type B2CAssessmentStudent } from "../domain/assessments";
import { saveB2CAssessmentAction } from "../server/assessment-actions";

export function AssessmentEditor({ classId, exam, today, onClose, onSaved }: { classId: string; exam: B2CAssessment | null; today: string; onClose: () => void; onSaved: (id: string) => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{exam ? "Sửa bài kiểm tra" : "Thêm bài kiểm tra"}</DialogTitle><DialogDescription>Kiểm tra giữa kỳ / cuối kỳ của lớp.</DialogDescription></DialogHeader>
    <form onSubmit={async (event) => {
      event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setError("");
      try {
        const r = await saveB2CAssessmentAction("exam", { request_id: requestId, class_id: classId, id: exam?.id ?? null, expected_updated_at: exam?.updated_at ?? null, title: f.get("title"), kind: f.get("kind"), exam_date: f.get("exam_date"), max_score: Number(f.get("max_score")) });
        if (r.error) setError(r.error); else if (r.id) onSaved(r.id);
      } catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-4">
      <label className="grid gap-1 text-sm">Tên bài kiểm tra<Input name="title" required maxLength={200} defaultValue={exam?.title ?? ""} /></label>
      <label className="grid gap-1 text-sm">Loại kiểm tra<select name="kind" defaultValue={exam?.kind ?? "midterm"} className="bg-background h-10 rounded-md border px-3">{Object.entries(B2C_ASSESSMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Ngày kiểm tra<Input name="exam_date" type="date" required min="1900-01-01" defaultValue={exam?.exam_date ?? today} /></label>
      <label className="grid gap-1 text-sm">Điểm tối đa<Input name="max_score" type="number" step="0.01" min="0.01" max="1000" required defaultValue={exam?.max_score ?? 10} /></label>
      <p className="text-muted-foreground text-xs">Khi đã có kết quả, ngày kiểm tra và thang điểm được giữ để bảo toàn ý nghĩa điểm cũ.</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit">{busy ? "Đang lưu…" : "Lưu bài kiểm tra"}</Button>
    </fieldset></form>
  </DialogContent></Dialog>;
}

export function AssessmentResultEditor({ classId, exam, student, onClose, onSaved }: { classId: string; exam: B2CAssessment; student: B2CAssessmentStudent; onClose: () => void; onSaved: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>Nhập điểm · {student.full_name}</DialogTitle><DialogDescription>{exam.title} · Thang điểm {exam.max_score}</DialogDescription></DialogHeader>
    <form onSubmit={async (event) => {
      event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setError("");
      const raw = String(f.get("score") ?? "").trim();
      try {
        const r = await saveB2CAssessmentAction("result", { request_id: requestId, class_id: classId, exam_id: exam.id, enrollment_id: student.enrollment_id, expected_updated_at: student.updated_at, score: raw === "" ? null : Number(raw), feedback: f.get("feedback"), reason: f.get("reason") ?? "" });
        if (r.error) setError(r.error); else onSaved();
      } catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-4">
      <label className="grid gap-1 text-sm">Điểm<Input name="score" type="number" min="0" max={exam.max_score} step="0.01" defaultValue={student.score ?? ""} /></label>
      <p className="text-muted-foreground text-xs">Để trống = chưa chấm. Điểm 0 được tính là đã chấm.</p>
      <label className="grid gap-1 text-sm">Nhận xét<Textarea name="feedback" maxLength={2000} defaultValue={student.feedback} /></label>
      {student.updated_at && <label className="grid gap-1 text-sm">Lý do sửa kết quả<Textarea name="reason" required maxLength={1000} /></label>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit">{busy ? "Đang lưu…" : "Lưu kết quả"}</Button>
    </fieldset></form>
  </DialogContent></Dialog>;
}
