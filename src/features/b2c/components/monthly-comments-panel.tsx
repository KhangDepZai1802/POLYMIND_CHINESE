"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MonthlyCommentsModel, MonthlyCommentStudent } from "../domain/monthly-comments";
import { readMonthlyCommentsAction } from "../server/monthly-comment-actions";
import { MonthlyCommentEditor } from "./monthly-comment-editor";
import { MonthlyCommentDetailDialog } from "./monthly-comment-detail";

export function MonthlyCommentsPanel({ classId, today, canWrite, canShare }: { classId: string; today: string; canWrite: boolean; canShare: boolean }) {
  const [month, setMonth] = useState(today.slice(0, 7)), [query, setQuery] = useState(""), [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const [data, setData] = useState<MonthlyCommentsModel | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [editing, setEditing] = useState<MonthlyCommentStudent | null>(null), [detail, setDetail] = useState<MonthlyCommentStudent | null>(null);
  useEffect(() => {
    let active = true;
    readMonthlyCommentsAction({ classId, month, query, page }).then((r) => { if (active) { setData(r); setError(""); setBusy(false); } }).catch((e) => { if (active) { setData(null); setError(e instanceof Error ? e.message : "Không tải được nhận xét tháng."); setBusy(false); } });
    return () => { active = false; };
  }, [classId, month, query, page, revision]);
  function refresh() { setBusy(true); setRevision((v) => v + 1); }
  return <section aria-label="Nhận xét giáo viên hàng tháng" className="space-y-4"><h2 className="font-semibold">Nhận xét giáo viên hàng tháng</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setMonth(String(f.get("month"))); setQuery(String(f.get("q"))); setPage(0); setRevision((v) => v + 1); }}>
      <label className="grid gap-1 text-sm">Tháng nhận xét<Input name="month" type="month" min="1900-01" max={today.slice(0, 7)} defaultValue={month} required /></label>
      <Input name="q" aria-label="Tìm học viên nhận xét tháng" placeholder="Mã hoặc tên học viên…" maxLength={200} defaultValue={query} className="w-full sm:w-64" /><Button type="submit" variant="outline">Xem tháng</Button>
    </form>
    <p className="text-muted-foreground text-xs">Mỗi học viên một bản nhận xét cho từng lớp/tháng. Giáo viên điền sáu mục của mẫu, hoàn tất rồi chuẩn bị gửi phụ huynh.</p>
    {busy ? <p role="status" className="py-8 text-center">Đang tải nhận xét…</p> : error ? <div><p role="alert" className="text-destructive">{error}</p><Button onClick={refresh} variant="outline">Thử lại</Button></div> : data && <>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[44rem] text-left text-sm"><caption className="sr-only">Nhận xét tháng {month}</caption><thead className="bg-muted"><tr>{["Mã HV", "Học viên", "Nhận xét", "Ghi nhận gửi", "Thao tác"].map((h) => <th key={h} scope="col" className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{data.rows.map((s) => <tr key={s.enrollment_id} className="border-t"><td className="p-3 font-mono">{s.student_code}</td><td className="p-3 font-medium">{s.full_name}</td><td className="p-3">{!s.report ? "Chưa nhận xét" : s.report.status === "draft" ? "Bản nháp" : "Hoàn tất"}{s.report && <span className="text-muted-foreground mt-1 block text-xs">{s.report.author_name}</span>}</td><td className="p-3">{!canShare ? "—" : s.last_delivery ? <><span>{s.last_delivery.channel === "zalo" ? "Zalo" : "Email"} · {s.last_delivery.recipient_name}</span><span className="text-muted-foreground mt-1 block text-xs">Người dùng xác nhận · {new Date(s.last_delivery.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>{s.report && new Date(s.report.updated_at).getTime() !== new Date(s.last_delivery.report_updated_at).getTime() && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">Nội dung đã sửa sau lần ghi nhận gửi</span>}</> : "Chưa ghi nhận"}</td><td className="p-3"><div className="flex flex-wrap gap-2">{canWrite && <Button size="sm" variant="outline" onClick={() => setEditing(s)}>{s.report ? "Sửa nhận xét" : "Nhập nhận xét"}</Button>}{s.report && <Button size="sm" variant="outline" onClick={() => setDetail(s)}>{canShare ? "Xem / Chuẩn bị gửi" : "Xem / Lịch sử"}</Button>}</div></td></tr>)}</tbody></table></div>
      {!data.rows.length && <p className="text-muted-foreground py-6 text-center">Không có học viên phù hợp trong tháng này.</p>}
      <div className="flex items-center justify-between text-sm"><span>{data.total} học viên · Trang {page + 1}/{Math.max(1, Math.ceil(data.total / 20))}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => { setBusy(true); setPage((v) => v - 1); }}>Trước</Button><Button variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => { setBusy(true); setPage((v) => v + 1); }}>Sau</Button></div></div>
    </>}
    {editing && <MonthlyCommentEditor classId={classId} month={month} student={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {detail && <MonthlyCommentDetailDialog classId={classId} student={detail} canShare={canShare} onClose={() => setDetail(null)} onDelivered={refresh} />}
  </section>;
}
