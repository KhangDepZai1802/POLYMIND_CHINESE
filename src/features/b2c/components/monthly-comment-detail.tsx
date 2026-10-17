"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MONTHLY_COMMENT_FIELDS, type MonthlyCommentStudent } from "../domain/monthly-comments";
import { confirmMonthlyCommentDeliveryAction, readMonthlyCommentDetailAction, type MonthlyCommentDetail as Detail } from "../server/monthly-comment-actions";

export function MonthlyCommentDetailDialog({ classId, student, canShare, onClose, onDelivered }: { classId: string; student: MonthlyCommentStudent; canShare: boolean; onClose: () => void; onDelivered: () => void }) {
  const [data, setData] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0), [recipientKey, setRecipientKey] = useState(""), [channel, setChannel] = useState<"zalo" | "email">("zalo"), [confirmed, setConfirmed] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const reportId = student.report!.id;
  useEffect(() => {
    let active = true;
    readMonthlyCommentDetailAction(reportId, page).then((r) => { if (active) { setData(r); setLoading(false); setError(""); } }).catch((e) => { if (active) { setError(e instanceof Error ? e.message : "Không tải được nhận xét."); setData(null); setLoading(false); } });
    return () => { active = false; };
  }, [reportId, page, revision]);
  const recipient = data?.recipients.find((p) => p.key === recipientKey), destination = recipient?.[channel];
  const stamp = (s: string) => new Date(s).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Nhận xét tháng · {student.full_name}</DialogTitle><DialogDescription>Xem nội dung, lịch sử sửa và các lần người dùng xác nhận đã gửi thủ công.</DialogDescription></DialogHeader>
    {loading ? <p role="status">Đang tải…</p> : !data ? <div><p role="alert" className="text-destructive">{error}</p><Button onClick={() => { setLoading(true); setRevision((v) => v + 1); }}>Thử lại</Button></div> : <>
      <pre className="bg-muted/40 rounded-lg border p-4 font-sans text-sm break-words whitespace-pre-wrap">{data.message}</pre>
      {canShare && data.status === "ready" ? <section className="space-y-3 rounded-lg border p-4" aria-label="Chuẩn bị gửi phụ huynh">
        <h3 className="font-semibold">Chuẩn bị gửi phụ huynh</h3>
        <p className="text-muted-foreground text-xs">Gửi bằng Zalo hoặc ứng dụng email của bạn. Sao chép/mở email chưa được tính là đã gửi; chỉ xác nhận sau khi thực sự gửi.</p>
        {!data.recipients.length && <p className="text-sm">Chưa có phụ huynh liên kết hoặc thông tin Zalo. Quản lý cập nhật tại mục Phụ huynh và liên kết đúng học viên.</p>}
        <label className="grid gap-1 text-sm">Phụ huynh nhận<select value={recipientKey} onChange={(e) => { setRecipientKey(e.target.value); setConfirmed(false); }} className="bg-background h-10 rounded-md border px-3" disabled={busy}><option value="">Chọn phụ huynh</option>{data.recipients.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Kênh gửi<select value={channel} onChange={(e) => { setChannel(e.target.value as typeof channel); setConfirmed(false); }} className="bg-background h-10 rounded-md border px-3" disabled={busy}><option value="zalo">Zalo</option><option value="email">Email</option></select></label>
        {recipient && <p className="text-sm">Đến: {recipient.name} · {destination || `Chưa có ${channel === "email" ? "email phụ huynh" : "Zalo phụ huynh"}`}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(data.message); setNotice("Đã sao chép nội dung; chưa ghi nhận gửi. Bạn gửi cho đúng phụ huynh rồi xác nhận bên dưới."); } catch { setNotice("Không sao chép tự động được. Bạn có thể chọn và sao chép nội dung phía trên."); } }}>Sao chép nội dung gửi Zalo/email</Button>
          {channel === "email" && recipient?.email && <Button variant="outline" asChild><a href={`mailto:${encodeURIComponent(recipient.email)}?subject=${encodeURIComponent(`Nhận xét học tập · ${student.full_name}`)}&body=${encodeURIComponent(data.message)}`} onClick={() => setNotice("Hãy gửi trong ứng dụng email, rồi quay lại xác nhận tại đây.")}>Mở email soạn sẵn</a></Button>}
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy || !destination} onChange={(e) => setConfirmed(e.target.checked)} />Tôi đã gửi nội dung trên cho phụ huynh đã chọn qua {channel === "zalo" ? "Zalo" : "email"}.</label>
        <Button disabled={busy || !confirmed || !destination} onClick={async () => {
          setBusy(true); setError(""); setNotice("");
          try {
            const result = await confirmMonthlyCommentDeliveryAction({ request_id: requestId, class_id: classId, report_id: reportId, expected_updated_at: data.updated_at, expected_message: data.message, expected_destination: destination, channel, recipient_key: recipientKey, confirmed: true });
            if (result.error) setError(result.error); else { setRequestId(crypto.randomUUID()); setConfirmed(false); setNotice("Đã ghi nhận lần gửi thủ công; hệ thống không xác minh trạng thái nhận/đọc của phụ huynh."); setRevision((v) => v + 1); onDelivered(); }
          } catch { setError("Không ghi nhận được. Vui lòng thử lại."); } finally { setBusy(false); }
        }}>{busy ? "Đang lưu…" : "Ghi nhận đã gửi thủ công"}</Button>
      </section> : data.status === "draft" ? <p className="text-muted-foreground text-sm">Bản nháp: hoàn tất nhận xét trước khi chuẩn bị gửi phụ huynh.</p> : <p className="text-muted-foreground text-sm">Bạn chưa được cấp quyền chuẩn bị gửi và ghi nhận gửi nhận xét tháng.</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Lịch sử chỉnh sửa · {data.history_total}</h3>{data.history.map((h) => <details key={h.id} className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">{h.actor_name} · {stamp(h.created_at)} · {h.after_data.status === "ready" ? "Hoàn tất" : "Bản nháp"}</summary><dl className="mt-3 space-y-3">{Object.entries(MONTHLY_COMMENT_FIELDS).filter(([key]) => h.before_data?.content[key] !== h.after_data.content[key]).map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd className="break-words whitespace-pre-wrap">Trước: {h.before_data?.content[key] || "Chưa có"}<br />Sau: {h.after_data.content[key] || "Chưa có"}</dd></div>)}</dl></details>)}</section>
      {canShare && <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Lịch sử ghi nhận gửi thủ công · {data.delivery_total}</h3>{!data.deliveries.length && <p className="text-muted-foreground text-sm">Chưa có lần gửi được xác nhận.</p>}{data.deliveries.map((d) => <details key={d.id} className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">{d.channel === "zalo" ? "Zalo" : "Email"} · {d.recipient_name} · {stamp(d.created_at)}</summary><p className="mt-2">{d.destination} · Người xác nhận: {d.actor_name}</p><p className="mt-2 break-words whitespace-pre-wrap">{d.message}</p></details>)}</section>}
      {Math.max(data.history_total, data.delivery_total) > 20 && <div className="flex items-center justify-between text-sm"><Button variant="outline" disabled={busy || page === 0} onClick={() => { setLoading(true); setPage((v) => v - 1); }}>Trước</Button><span>Trang lịch sử {page + 1}/{Math.ceil(Math.max(data.history_total, data.delivery_total) / 20)}</span><Button variant="outline" disabled={busy || (page + 1) * 20 >= Math.max(data.history_total, data.delivery_total)} onClick={() => { setLoading(true); setPage((v) => v + 1); }}>Sau</Button></div>}
    </>}
  </DialogContent></Dialog>;
}
