"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CERTIFICATE_TYPE_SUGGESTIONS, type CertificateResult, type CertificateStudent } from "../domain/certificate-results";
import { findCertificateStudentsAction, saveCertificateResultAction } from "../server/certificate-actions";

export function CertificateResultEditor({ result, initialStudent, today, onClose, onSaved }: { result?: CertificateResult; initialStudent?: CertificateStudent | null; today: string; onClose: () => void; onSaved: () => void }) {
  const [student, setStudent] = useState<CertificateStudent | null>(result ? { id: result.student_id, code: result.student_code, full_name: result.full_name } : initialStudent ?? null);
  const [query, setQuery] = useState(""), [page, setPage] = useState(0), [matches, setMatches] = useState<{ rows: CertificateStudent[]; total: number } | null>(null);
  const [requestId] = useState(() => crypto.randomUUID()), [busy, setBusy] = useState(false), [searching, setSearching] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  async function search(p: number) {
    const token = ++generation.current; setSearching(true); setError("");
    try { const data = await findCertificateStudentsAction(query, p); if (generation.current === token) { setMatches(data); setPage(p); } }
    catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : "Không tìm được học viên."); }
    finally { if (generation.current === token) setSearching(false); }
  }
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) { generation.current++; onClose(); } }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>{result ? "Sửa kết quả chứng chỉ" : "Thêm kết quả chứng chỉ"}</DialogTitle><DialogDescription>Gắn với hồ sơ học viên. Nhập điểm/xếp loại đúng như kết quả thực tế, không quy đổi giữa các chứng chỉ.</DialogDescription></DialogHeader>
    {!student ? <div className="space-y-3"><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(0); }}><Input aria-label="Tìm học viên chứng chỉ" placeholder="Mã hoặc tên học viên…" value={query} required maxLength={200} onChange={(e) => { generation.current++; setQuery(e.target.value); setMatches(null); setSearching(false); }} /><Button type="submit" disabled={searching}>Tìm học viên</Button></form>
      {searching ? <p role="status">Đang tìm…</p> : matches && <><ul className="divide-y rounded-lg border">{matches.rows.map((s) => <li key={s.id}><button type="button" className="hover:bg-muted w-full p-3 text-left text-sm" onClick={() => { generation.current++; setStudent(s); }}>{s.code} · {s.full_name}</button></li>)}</ul>{!matches.total && <p className="text-muted-foreground text-sm">Không tìm thấy học viên.</p>}{matches.total > 20 && <div className="flex justify-between"><Button variant="outline" disabled={page === 0} onClick={() => void search(page - 1)}>Trước</Button><span>Trang {page + 1}/{Math.ceil(matches.total / 20)}</span><Button variant="outline" disabled={(page + 1) * 20 >= matches.total} onClick={() => void search(page + 1)}>Sau</Button></div>}</>}
    </div> : <form onSubmit={async (event) => {
      event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setError("");
      try {
        const r = await saveCertificateResultAction({ request_id: requestId, id: result?.id ?? null, expected_updated_at: result?.updated_at ?? null, student_id: student.id, certificate_type: f.get("certificate_type"), level: f.get("level"), score: f.get("score"), exam_date: f.get("exam_date"), marketing_allowed: f.get("marketing_allowed") === "on", marketing_note: f.get("marketing_note"), notes: f.get("notes") });
        if (r.error) setError(r.error); else onSaved();
      } catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-4">
      <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg p-3 text-sm"><span className="font-medium">{student.code} · {student.full_name}</span>{!result && <Button variant="ghost" type="button" onClick={() => setStudent(null)}>Đổi học viên</Button>}</div>
      <label className="grid gap-1 text-sm">Loại chứng chỉ<Input name="certificate_type" required maxLength={100} list="b2c-certificate-types" defaultValue={result?.certificate_type ?? ""} placeholder="Cambridge, IELTS, HSK…" /></label><datalist id="b2c-certificate-types">{CERTIFICATE_TYPE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <label className="grid gap-1 text-sm">Cấp độ / Bài thi<Input name="level" maxLength={100} defaultValue={result?.level ?? ""} placeholder="Movers, B1 Preliminary, HSK 3…" /></label>
      <label className="grid gap-1 text-sm">Điểm / Xếp loại<Input name="score" required maxLength={100} defaultValue={result?.score ?? ""} placeholder="6.5, 180/200, Pass…" /></label>
      <label className="grid gap-1 text-sm">Ngày thi<Input name="exam_date" required type="date" min="1900-01-01" max={today} defaultValue={result?.exam_date ?? today} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketing_allowed" className="mt-1" defaultChecked={result?.marketing_allowed ?? false} />Chọn làm tư liệu marketing</label>
      <p className="text-muted-foreground text-xs">Chỉ chọn khi trung tâm đã xác nhận được phép sử dụng thông tin học viên. File marketing gồm tên, mã học viên và kết quả; không tự đăng công khai.</p>
      <label className="grid gap-1 text-sm">Ghi chú sử dụng marketing (nội bộ)<Textarea name="marketing_note" maxLength={500} defaultValue={result?.marketing_note ?? ""} /></label>
      <label className="grid gap-1 text-sm">Ghi chú kết quả (nội bộ)<Textarea name="notes" maxLength={2000} defaultValue={result?.notes ?? ""} /></label>
      <Button type="submit">{busy ? "Đang lưu…" : "Lưu kết quả chứng chỉ"}</Button>
    </fieldset></form>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
  </DialogContent></Dialog>;
}
