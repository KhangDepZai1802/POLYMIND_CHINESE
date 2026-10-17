"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { B2C_ASSESSMENT_TYPES, type B2CAssessment, type B2CAssessmentStudent, type B2CAssessmentsModel } from "../domain/assessments";
import { readB2CAssessmentsAction } from "../server/assessment-actions";
import { AssessmentEditor, AssessmentResultEditor } from "./assessment-editors";
import { AssessmentHistoryDialog } from "./assessment-history-dialog";

export function AssessmentsPanel({ classId, today, canGrade }: { classId: string; today: string; canGrade: boolean }) {
  const [data, setData] = useState<B2CAssessmentsModel | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [examId, setExamId] = useState<string | null>(null), [page, setPage] = useState(0), [examPage, setExamPage] = useState(0), [query, setQuery] = useState(""), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ exam: B2CAssessment | null } | null>(null), [student, setStudent] = useState<B2CAssessmentStudent | null>(null);
  useEffect(() => {
    let active = true;
    readB2CAssessmentsAction({ classId, examId, page, examPage, query }).then((r) => { if (active) { setData(r); setError(""); setBusy(false); } }).catch((e) => { if (active) { setError(e instanceof Error ? e.message : "Không tải được bài kiểm tra."); setData(null); setBusy(false); } });
    return () => { active = false; };
  }, [classId, examId, page, examPage, query, revision]);
  function refresh() { setBusy(true); setRevision((v) => v + 1); }
  const selected = data?.selected;
  return <section aria-label="Kiểm tra giữa kỳ và cuối kỳ" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Kiểm tra giữa kỳ / cuối kỳ</h2>{canGrade && <Button onClick={() => setEditor({ exam: null })}>Thêm bài kiểm tra</Button>}</div>
    {busy ? <p role="status" className="text-muted-foreground py-8 text-center">Đang tải bài kiểm tra…</p> : error ? <div><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={refresh}>Thử lại</Button></div> : data && <>
      {!data.exams.length ? <p className="text-muted-foreground py-6">Chưa có bài kiểm tra giữa kỳ hoặc cuối kỳ.</p> : <>
        <label className="grid gap-1 text-sm">Bài kiểm tra<select aria-label="Bài kiểm tra" value={selected?.id ?? ""} onChange={(e) => { setBusy(true); setExamId(e.target.value); setPage(0); }} className="bg-background h-10 w-full rounded-md border px-3">{selected && !data.exams.some((a) => a.id === selected.id) && <option value={selected.id}>{B2C_ASSESSMENT_TYPES[selected.kind]} · {selected.title}</option>}{data.exams.map((a) => <option key={a.id} value={a.id}>{B2C_ASSESSMENT_TYPES[a.kind]} · {a.title} · {a.exam_date.split("-").reverse().join("/")}</option>)}</select></label>
        {data.exam_total > 10 && <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={examPage === 0} onClick={() => { setBusy(true); setExamPage((v) => v - 1); setExamId(null); setPage(0); }}>Các bài trước</Button><span className="text-sm">Trang bài {examPage + 1}/{Math.ceil(data.exam_total / 10)}</span><Button variant="outline" disabled={(examPage + 1) * 10 >= data.exam_total} onClick={() => { setBusy(true); setExamPage((v) => v + 1); setExamId(null); setPage(0); }}>Các bài sau</Button></div>}
        {selected && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Thang điểm {selected.max_score} · Đã chấm {data.graded}/{data.total} học viên{query ? " trong kết quả tìm kiếm" : ""}</p><div className="flex flex-wrap gap-2">{canGrade && <Button variant="outline" onClick={() => setEditor({ exam: selected })}>Sửa bài kiểm tra</Button>}<AssessmentHistoryDialog key={selected.id} examId={selected.id} /></div></div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setBusy(true); setPage(0); setQuery(String(new FormData(event.currentTarget).get("q") ?? "")); setRevision((v) => v + 1); }}><Input name="q" aria-label="Tìm học viên kiểm tra" placeholder="Tìm mã hoặc tên học viên…" defaultValue={query} maxLength={200} /><Button type="submit" variant="outline">Tìm</Button></form>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[40rem] text-left text-sm"><caption className="sr-only">Kết quả {selected.title}</caption><thead className="bg-muted"><tr>{["Mã HV", "Học viên", "Điểm", "Nhận xét", ...(canGrade ? ["Thao tác"] : [])].map((h) => <th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{data.rows.map((s) => <tr key={s.enrollment_id} className="border-t"><td className="px-3 py-3 font-mono">{s.student_code}</td><td className="px-3 py-3 font-medium">{s.full_name}</td><td className="px-3 py-3 whitespace-nowrap tabular-nums">{s.score == null ? <span className="text-muted-foreground">Chưa chấm</span> : `${s.score}/${selected.max_score}`}</td><td className="max-w-80 px-3 py-3 break-words whitespace-pre-wrap">{s.feedback || "—"}</td>{canGrade && <td className="px-3 py-3"><Button variant="outline" size="sm" disabled={selected.exam_date > today} onClick={() => setStudent(s)}>{s.updated_at ? "Sửa kết quả" : "Nhập điểm"}</Button></td>}</tr>)}</tbody></table></div>
          {!data.rows.length && <p className="text-muted-foreground py-4 text-center">Không có học viên phù hợp với ngày kiểm tra và bộ lọc.</p>}
          {selected.exam_date > today && <p className="text-muted-foreground text-sm">Chưa đến ngày kiểm tra, chưa thể nhập kết quả.</p>}
          <div className="flex items-center justify-between gap-2 text-sm"><span>{data.total} học viên · Trang {page + 1}/{Math.max(1, Math.ceil(data.total / 20))}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => { setBusy(true); setPage((v) => v - 1); }}>Trước</Button><Button variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => { setBusy(true); setPage((v) => v + 1); }}>Sau</Button></div></div>
        </>}
      </>}
    </>}
    {editor && <AssessmentEditor classId={classId} exam={editor.exam} today={today} onClose={() => setEditor(null)} onSaved={(id) => { setEditor(null); setExamPage(0); setExamId(id); setPage(0); setQuery(""); refresh(); }} />}
    {student && selected && <AssessmentResultEditor classId={classId} exam={selected} student={student} onClose={() => setStudent(null)} onSaved={() => { setStudent(null); refresh(); }} />}
  </section>;
}
