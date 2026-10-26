"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveCenterRecordAction } from "../server/archive-actions";

export function DeleteCenterRecord({ entity, id, name }: { entity: "student" | "parent" | "package"; id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const label = entity === "student" ? "học viên" : entity === "parent" ? "phụ huynh" : "gói học phí";
  return <Dialog open={open} onOpenChange={v => { if (!busy) { setOpen(v); setError(""); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive" aria-label={`Xóa ${label} ${name}`}>Xóa {label}</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Xóa {label}</DialogTitle><DialogDescription>{name}. {entity === "package" ? "Gói được loại khỏi học phí hiện tại. Cần xử lý hết tiền đã thu trước khi xóa; phiếu thu và lịch sử vẫn được giữ." : entity === "student" ? "Học viên được loại khỏi danh sách đang sử dụng ở tất cả lớp. Điểm danh và học phí cũ vẫn được giữ để tra cứu." : "Phụ huynh được loại khỏi danh sách đang sử dụng. Hồ sơ các con và lịch sử liên kết vẫn được giữ."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        const reason = new FormData(e.currentTarget).get("reason");
        setBusy(true); setError("");
        try {
          const result = await archiveCenterRecordAction({ entity, id, reason });
          if (result.error) setError(result.error); else { setOpen(false); router.refresh(); }
        } catch { setError("Không kết nối được. Vui lòng thử lại."); } finally { setBusy(false); }
      }}><label className="grid gap-2 text-sm">Lý do xóa<Input name="reason" required maxLength={1000} disabled={busy} /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Quay lại</Button><Button type="submit" variant="destructive" disabled={busy}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</Button></div></form>
    </DialogContent>
  </Dialog>;
}
