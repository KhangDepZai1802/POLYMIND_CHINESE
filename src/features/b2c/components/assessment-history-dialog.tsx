"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { B2C_ASSESSMENT_TYPES, type B2CAssessmentHistory } from "../domain/assessments";
import { readB2CAssessmentHistoryAction } from "../server/assessment-actions";

function details(data: B2CAssessmentHistory["before_data"]) {
  if (!data) return "Chưa có";
  if ("score" in data) return `${data.score ?? "Chưa chấm"}${data.score != null ? `/${data.max_score}` : ""} · ${data.feedback || "Chưa nhận xét"}`;
  return `${data.title} · ${B2C_ASSESSMENT_TYPES[data.kind as keyof typeof B2C_ASSESSMENT_TYPES]} · ${String(data.exam_date).split("-").reverse().join("/")} · Thang điểm ${data.max_score}`;
}
export function AssessmentHistoryDialog({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [data, setData] = useState<{ rows: B2CAssessmentHistory[]; total: number } | null>(null), [page, setPage] = useState(0);
  const generation = useRef(0);
  async function load(p: number) {
    const token = ++generation.current; setBusy(true); setError("");
    try { const r = await readB2CAssessmentHistoryAction(examId, p); if (generation.current === token) { setData(r); setPage(p); } }
    catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : "Không tải được lịch sử."); }
    finally { if (generation.current === token) setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setData(null); void load(0); } else generation.current++; }}>
    <DialogTrigger asChild><Button variant="outline">Lịch sử chỉnh sửa</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Lịch sử bài kiểm tra và điểm</DialogTitle><DialogDescription>Người thực hiện, thời gian và nội dung trước/sau mỗi thay đổi.</DialogDescription></DialogHeader>
      {busy ? <p role="status">Đang tải…</p> : error ? <div><p role="alert" className="text-destructive text-sm">{error}</p><Button onClick={() => void load(page)}>Thử lại</Button></div> : data && <>
        {!data.rows.length && <p>Chưa có lịch sử chỉnh sửa.</p>}
        <ol className="space-y-3">{data.rows.map((h) => <li key={h.id} className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{h.student_name ?? "Thông tin bài kiểm tra"}</p>
          <p className="mt-1 break-words whitespace-pre-wrap">Trước: {details(h.before_data)}</p><p className="break-words whitespace-pre-wrap">Sau: {details(h.after_data)}</p>
          <p className="mt-1 break-words whitespace-pre-wrap">{h.reason}</p><p className="text-muted-foreground mt-1 text-xs">{h.actor_name} · {new Date(h.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        </li>)}</ol>
        {data.total > 20 && <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 0} onClick={() => void load(page - 1)}>Trước</Button><span>Trang {page + 1}/{Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => void load(page + 1)}>Sau</Button></div>}
      </>}
    </DialogContent>
  </Dialog>;
}
