"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { readCertificateHistoryAction } from "../server/certificate-actions";
const fields = { certificate_type: "Loại chứng chỉ", level: "Cấp độ / Bài thi", score: "Điểm / Xếp loại", exam_date: "Ngày thi", marketing_allowed: "Chọn marketing", marketing_note: "Ghi chú marketing", notes: "Ghi chú kết quả", is_archived: "Đã lưu trữ" };
export function CertificateHistoryDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false), [data, setData] = useState<Awaited<ReturnType<typeof readCertificateHistoryAction>> | null>(null), [page, setPage] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  async function load(p: number) {
    const token = ++generation.current; setBusy(true); setError("");
    try { const r = await readCertificateHistoryAction(id, p); if (generation.current === token) { setData(r); setPage(p); } }
    catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : "Không tải được lịch sử."); }
    finally { if (generation.current === token) setBusy(false); }
  }
  const value = (v: unknown) => v === true ? "Có" : v === false ? "Không" : typeof v === "string" && v ? v : "Chưa có";
  return <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setData(null); void load(0); } else generation.current++; }}><DialogTrigger asChild><Button size="sm" variant="outline">Lịch sử</Button></DialogTrigger><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Lịch sử kết quả chứng chỉ</DialogTitle><DialogDescription>Thông tin trước/sau, người thực hiện và thời gian.</DialogDescription></DialogHeader>
    {busy ? <p role="status">Đang tải…</p> : error ? <div><p role="alert" className="text-destructive">{error}</p><Button onClick={() => void load(page)}>Thử lại</Button></div> : data && <>
      {!data.rows.length && <p>Chưa có lịch sử.</p>}{data.rows.map((h) => <details key={h.id} className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">{h.action === "archive" ? "Lưu trữ" : h.action === "restore" ? "Khôi phục" : h.before_data ? "Cập nhật" : "Thêm kết quả"} · {h.actor_name} · {new Date(h.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</summary><dl className="mt-3 space-y-3">{Object.entries(fields).filter(([key]) => h.before_data?.[key] !== h.after_data[key]).map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd className="break-words whitespace-pre-wrap">Trước: {value(h.before_data?.[key])}<br />Sau: {value(h.after_data[key])}</dd></div>)}</dl></details>)}
      {data.total > 20 && <div className="flex items-center justify-between text-sm"><Button variant="outline" disabled={page === 0} onClick={() => void load(page - 1)}>Trước</Button><span>Trang {page + 1}/{Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => void load(page + 1)}>Sau</Button></div>}
    </>}
  </DialogContent></Dialog>;
}
