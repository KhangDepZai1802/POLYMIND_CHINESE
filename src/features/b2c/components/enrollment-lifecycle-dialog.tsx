"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ENROLLMENT_EVENT_LABELS, type EnrollmentLifecycleContext } from "../domain/enrollment-lifecycle";
import { readEnrollmentLifecycleAction, saveEnrollmentLifecycleAction } from "../server/enrollment-lifecycle-actions";

export function EnrollmentLifecycleDialog({ enrollmentId, fullName, className }: { enrollmentId: string; fullName: string; className: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<EnrollmentLifecycleContext | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [action, setAction] = useState<keyof typeof ENROLLMENT_EVENT_LABELS>("transfer");
  const [requestId, setRequestId] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dateLabel = (s: string) => s.split("-").reverse().join("/");

  async function load(nextPage = 0) {
    setBusy(true); setError("");
    try {
      const result = await readEnrollmentLifecycleAction(enrollmentId, nextPage);
      setData(result); setPage(nextPage);
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được lịch sử."); }
    finally { setBusy(false); }
  }
  const closed = data && ["withdrawn", "completed", "transferred"].includes(data.enrollment.status);
  return <Dialog open={open} onOpenChange={(value) => {
    if (busy) return;
    setOpen(value);
    if (value) { setData(null); setSuccess(""); setAction("transfer"); setRequestId(crypto.randomUUID()); void load(); }
  }}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" title="Chuyển lớp / Bảo lưu và lịch sử" aria-label={`Chuyển lớp / Bảo lưu ${fullName}`}><ArrowLeftRight className="size-4 text-violet-600 dark:text-violet-400" aria-hidden /></Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Chuyển lớp / Bảo lưu</DialogTitle><DialogDescription>{fullName} · {className}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
      {busy && <p role="status" className="text-muted-foreground text-sm">Đang xử lý…</p>}
      {!data && !busy && <Button variant="outline" onClick={() => void load()}>Thử tải lại</Button>}
      {data && <>
        {!closed && <form key={data.enrollment.updated_at} className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true); setError(""); setSuccess("");
          try {
            const result = await saveEnrollmentLifecycleAction({
              request_id: requestId, enrollment_id: enrollmentId, expected_updated_at: data.enrollment.updated_at,
              action, effective_date: form.get("effective_date"), reason: form.get("reason"),
              target_class_id: action === "transfer" ? form.get("target_class_id") : "",
              expected_return_date: action === "hold" ? form.get("expected_return_date") : "",
            });
            if (result.error) { setError(result.error); return; }
            setSuccess("Đã lưu thao tác và lịch sử. Học phí giữ nguyên để quản lý xử lý riêng.");
            setRequestId(crypto.randomUUID());
            router.refresh();
            const refreshed = await readEnrollmentLifecycleAction(enrollmentId, 0);
            setData(refreshed); setPage(0); setAction("transfer");
          } catch (e) { setError(e instanceof Error ? e.message : "Không kết nối được. Vui lòng thử lại."); }
          finally { setBusy(false); }
        }}>
          <fieldset disabled={busy} className="space-y-4">
            <label className="grid gap-1 text-sm">Thao tác
              <select name="action" value={action} onChange={(e) => setAction(e.target.value as typeof action)} className="border-input bg-background h-10 w-full rounded-md border px-3">
                <option value="transfer">Chuyển lớp</option>
                {data.enrollment.status === "on_hold" ? <option value="resume">Đi học lại</option> : <option value="hold">Bảo lưu</option>}
              </select>
            </label>
            {action === "transfer" && <label className="grid gap-1 text-sm">Lớp chuyển đến <span className="sr-only">bắt buộc</span>
              <select name="target_class_id" required defaultValue="" className="border-input bg-background h-10 w-full rounded-md border px-3">
                <option value="" disabled>Chọn lớp</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </label>}
            <label className="grid gap-1 text-sm">Ngày hiệu lực<Input name="effective_date" type="date" required max={today} defaultValue={today} /></label>
            {action === "hold" && <label className="grid gap-1 text-sm">Dự kiến học lại (nếu có)<Input name="expected_return_date" type="date" min={today} /></label>}
            <label className="grid gap-1 text-sm">Lý do<Textarea name="reason" required maxLength={1000} rows={3} /></label>
            <p className="text-muted-foreground text-xs">Học phí, hạn phí và các khoản đã thu giữ nguyên, quản lý xử lý riêng. Chuyển lớp tạo ghi danh mới; điểm danh và học phí cũ ở lại lớp cũ. Bảo lưu giữ chỗ, không tự gia hạn hoặc tự học lại.</p>
            <Button type="submit">{busy ? "Đang lưu…" : "Lưu thao tác"}</Button>
          </fieldset>
        </form>}
        <section className="border-t pt-4" aria-label="Lịch sử chuyển lớp và bảo lưu">
          <h3 className="font-semibold">Lịch sử chuyển lớp / Bảo lưu · {data.total}</h3>
          <p className="text-muted-foreground mt-1 text-xs">Toàn bộ các lớp của học viên. Ghi chú cũ được giữ nguyên, không tự suy thành lịch sử.</p>
          {data.events.length === 0 ? <p className="text-muted-foreground py-4 text-sm">Chưa có lịch sử chuyển lớp / bảo lưu.</p> : <ol className="mt-3 space-y-3">{data.events.map((item) => <li key={item.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{ENROLLMENT_EVENT_LABELS[item.action]} · {dateLabel(item.effective_date)}</p>
            <p>{item.from_class_name}{item.to_class_name ? ` → ${item.to_class_name}` : ""}</p>
            {item.expected_return_date && <p>Dự kiến học lại: {dateLabel(item.expected_return_date)}</p>}
            <p className="mt-1 break-words whitespace-pre-wrap">{item.reason}</p>
            <p className="text-muted-foreground mt-1 text-xs">{item.actor_name} · {new Date(item.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
          </li>)}</ol>}
          {data.total > 20 && <div className="mt-3 flex items-center justify-between"><Button variant="outline" disabled={busy || page === 0} onClick={() => void load(page - 1)}>Trước</Button><span className="text-sm">Trang {page + 1}/{Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={busy || (page + 1) * 20 >= data.total} onClick={() => void load(page + 1)}>Sau</Button></div>}
        </section>
      </>}
    </DialogContent>
  </Dialog>;
}
