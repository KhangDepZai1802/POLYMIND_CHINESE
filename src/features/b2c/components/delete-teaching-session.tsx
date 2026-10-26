"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveTeachingSessionAction } from "../server/teaching-actions";

export function DeleteTeachingSession({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Dialog open={open} onOpenChange={v => { if (!busy) { setOpen(v); setError(""); } }}><DialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive" aria-label={`Xóa buổi dạy ${label}`}>Xóa buổi dạy</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Xóa buổi dạy</DialogTitle><DialogDescription>{label}. Buổi được loại khỏi Giờ dạy & Lương và không tính vào tổng giờ, tiền công. Ảnh và lịch sử chấm công vẫn được giữ; lịch học và điểm danh học viên giữ nguyên.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        const reason = new FormData(e.currentTarget).get("reason");
        setBusy(true); setError("");
        try { const r = await archiveTeachingSessionAction({ id, reason }); if (r.error) setError(r.error); else { setOpen(false); router.refresh(); } }
        catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
      }}><label className="grid gap-2 text-sm">Lý do xóa<Input name="reason" required maxLength={1000} disabled={busy} /></label>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Quay lại</Button><Button type="submit" variant="destructive" disabled={busy}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</Button></div></form>
    </DialogContent></Dialog>;
}
