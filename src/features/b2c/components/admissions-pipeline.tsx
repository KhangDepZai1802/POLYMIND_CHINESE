"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { ADMISSION_STAGES, ADMISSION_STAGE_LABELS, type AdmissionLead } from "@/features/b2c/domain/admissions";
import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { B2C_CUSTOMER_SOURCES, B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { saveB2CAdmissionAction } from "@/features/b2c/server/actions";
import { useFormAction } from "@/lib/use-form-action";


export function LeadDialog({ lead }: { lead?: AdmissionLead }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(lead?.stage ?? "lead");
  const [source, setSource] = useState(lead?.customer_source ?? "");
  const { state, formAction } = useFormAction(saveB2CAdmissionAction, { onSuccess: () => setOpen(false) });
  const fieldId = lead?.id ?? "new";
  const selectClass = "border-input bg-background h-10 w-full rounded-md border px-3 text-sm";
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setStage(lead?.stage ?? "lead"); setSource(lead?.customer_source ?? ""); } }}>
    <DialogTrigger asChild>{lead ? <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Sửa khách ${lead.full_name}`}><Pencil className="size-4" aria-hidden /></Button> : <Button><Plus className="size-4" aria-hidden />Thêm khách</Button>}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{lead ? "Cập nhật khách tuyển sinh" : "Thêm khách tuyển sinh"}</DialogTitle><DialogDescription>Chọn giai đoạn để chuyển khách trong pipeline.</DialogDescription></DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={lead?.id ?? ""} />
        <div className="space-y-2"><Label htmlFor={`name-${fieldId}`}>Tên khách *</Label><Input id={`name-${fieldId}`} name="full_name" required maxLength={200} defaultValue={lead?.full_name ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`phone-${fieldId}`}>SĐT *</Label><Input id={`phone-${fieldId}`} name="phone" type="tel" inputMode="numeric" required pattern="[0-9]{10}" maxLength={10} title="Nhập đúng 10 chữ số" defaultValue={lead?.phone ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`program-${fieldId}`}>Chương trình *</Label><select id={`program-${fieldId}`} name="program_slug" required className={selectClass} defaultValue={lead?.program_slug ?? ""}><option value="" disabled>Chọn chương trình</option>{B2C_PROGRAMS.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor={`sales-${fieldId}`}>Người phụ trách *</Label><Input id={`sales-${fieldId}`} name="salesperson" required maxLength={200} defaultValue={lead?.salesperson ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`stage-${fieldId}`}>Giai đoạn *</Label><select id={`stage-${fieldId}`} name="stage" className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)}>{ADMISSION_STAGES.map((value) => <option key={value} value={value}>{ADMISSION_STAGE_LABELS[value]}</option>)}</select></div>
        {stage === "lost" ? <div className="space-y-2"><Label htmlFor={`failure-${fieldId}`}>Lý do thất bại *</Label><Textarea id={`failure-${fieldId}`} name="failure_reason" required maxLength={1000} defaultValue={lead?.failure_reason ?? ""} /></div> : <input type="hidden" name="failure_reason" value="" />}
        <div className="space-y-2"><Label htmlFor={`source-${fieldId}`}>Nguồn khách</Label><select id={`source-${fieldId}`} name="customer_source" className={selectClass} value={source} onChange={(e) => setSource(e.target.value)}><option value="">Chưa xác định</option>{B2C_CUSTOMER_SOURCES.map((value) => <option key={value} value={value}>{B2C_CUSTOMER_SOURCE_LABELS[value]}</option>)}</select></div>
        {source === "referral" ? <div className="space-y-2"><Label htmlFor={`referrer-${fieldId}`}>Người giới thiệu *</Label><Input id={`referrer-${fieldId}`} name="referrer_name" required maxLength={200} defaultValue={lead?.referrer_name ?? ""} /></div> : <input type="hidden" name="referrer_name" value="" />}
        <div className="space-y-2"><Label htmlFor={`notes-${fieldId}`}>Ghi chú</Label><Textarea id={`notes-${fieldId}`} name="notes" maxLength={2000} defaultValue={lead?.notes ?? ""} /></div>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        {state.fieldErrors && <p role="alert" className="text-destructive text-sm">{Object.values(state.fieldErrors).flat().join(" ")}</p>}
        <DialogFooter><SubmitButton>Lưu</SubmitButton></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
