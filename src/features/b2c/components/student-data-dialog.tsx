"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { B2C_CUSTOMER_SOURCE_LABELS, B2C_CUSTOMER_SOURCES } from "../domain/customer-source";
import type { StudentDataRow } from "../server/student-data";
import { saveStudentDataAction } from "../server/student-data-actions";

export function StudentDataDialog({ row }: { row: StudentDataRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setError(""); } }}>
    <DialogTrigger asChild><Button size="sm" variant="outline" aria-label={`Bổ sung hồ sơ ${row.full_name} · ${row.class_name}`}>Bổ sung</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Bổ sung hồ sơ học viên</DialogTitle><DialogDescription>{row.full_name} · {row.code} · {row.class_name}. SĐT và nguồn khách dùng chung giữa các lớp; người chốt và ngày học theo ghi danh này. Chỉ nhập thông tin đã xác nhận.</DialogDescription></DialogHeader>
      <form key={`${row.student_updated_at}:${row.enrollment_updated_at}`} className="space-y-3" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set("enrollment_id", row.enrollment_id); form.set("student_updated_at", row.student_updated_at); form.set("enrollment_updated_at", row.enrollment_updated_at);
        setBusy(true); setError("");
        try {
          const result = await saveStudentDataAction(form);
          if (result.error) setError(result.error);
          else { toast.success("Đã cập nhật hồ sơ."); setOpen(false); router.refresh(); }
        } catch { setError("Không lưu được hồ sơ. Vui lòng thử lại."); }
        finally { setBusy(false); }
      }}><fieldset disabled={busy} className="space-y-3">
        <label className="grid gap-1 text-sm">SĐT học viên / liên hệ<Input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} defaultValue={row.phone ?? ""} title="Nhập đúng 10 chữ số, giữ số 0 ở đầu" /></label>
        <label className="grid gap-1 text-sm">Nguồn khách<select name="customer_source" className="h-10 rounded-md border bg-background px-3" defaultValue={row.customer_source ?? ""}><option value="">Chưa xác định</option>{B2C_CUSTOMER_SOURCES.map(source => <option key={source} value={source}>{B2C_CUSTOMER_SOURCE_LABELS[source]}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Người giới thiệu (khi nguồn là Giới thiệu)<Input name="referrer_name" maxLength={200} defaultValue={row.referrer_name ?? ""} /></label>
        <label className="grid gap-1 text-sm">Người chốt<Input name="salesperson" maxLength={200} defaultValue={row.salesperson ?? ""} /></label>
        <label className="grid gap-1 text-sm">Ngày nhập học<Input name="enrollment_date" type="date" defaultValue={row.enrollment_date ?? ""} /></label>
        <label className="grid gap-1 text-sm">Ngày bắt đầu học<Input name="learning_start_date" type="date" defaultValue={row.learning_start_date ?? ""} /></label>
        <label className="grid gap-1 text-sm">Hạn học phí<Input name="tuition_end_date" type="date" defaultValue={row.tuition_end_date ?? ""} /></label>
        <p className="text-muted-foreground text-xs">Thông tin chưa rõ có thể để trống, không cần nhập số hoặc ngày giả.</p>
        <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu hồ sơ"}</Button>
      </fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>
    </DialogContent>
  </Dialog>;
}
