"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import { saveCandidateAction } from "@/features/xkld/server/candidate-actions";
import { CANDIDATE_SOURCES, HEALTH_STATUSES, type Assignee, type Candidate } from "@/features/xkld/domain/candidates";

export function CandidateDialog({ candidate, assignees, actorId }: { candidate?: Candidate; assignees: Assignee[]; actorId: string }) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const router = useRouter();
  const { state, formAction } = useFormAction(saveCandidateAction, { onSuccess: () => { setOpen(false); router.refresh(); } });
  const suffix = candidate?.id ?? "new";
  const fields = [
    { name: "full_name", label: "Họ tên", max: 200, type: "text", required: true },
    { name: "date_of_birth", label: "Ngày sinh", type: "date", required: true },
    { name: "phone", label: "Số điện thoại", max: 20, type: "tel", required: true },
    { name: "zalo", label: "Zalo", max: 200, type: "text", required: false },
    { name: "hometown", label: "Quê quán", max: 300, type: "text", required: true },
    { name: "education", label: "Trình độ", max: 200, type: "text", required: true },
    { name: "occupation", label: "Nghề", max: 200, type: "text", required: true },
  ] as const;
  return <Dialog open={open} onOpenChange={next => { if (next) setRequestId(crypto.randomUUID()); setOpen(next); }}>
    <DialogTrigger asChild>{candidate
      ? <Button variant="ghost" size="icon" aria-label={`Sửa ứng viên ${candidate.full_name}`}><Pencil className="size-4" aria-hidden /></Button>
      : <Button><Plus className="size-4" aria-hidden />Thêm ứng viên</Button>}
    </DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{candidate ? `Sửa ứng viên ${candidate.code}` : "Thêm ứng viên"}</DialogTitle>
        <DialogDescription>{candidate ? "Cập nhật hồ sơ và người phụ trách." : "Mã UV được cấp tự động khi lưu. Các mục có dấu * là bắt buộc."}</DialogDescription>
      </DialogHeader>
      {open && <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={candidate?.id ?? ""} />
        <input type="hidden" name="create_request_id" value={requestId} />
        <input type="hidden" name="updated_at" value={candidate?.updated_at ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(field => <div key={field.name} className="space-y-1.5">
            <Label htmlFor={`${field.name}-${suffix}`}>{field.label}{field.required ? " *" : ""}</Label>
            <Input id={`${field.name}-${suffix}`} name={field.name} type={field.type} required={field.required} maxLength={"max" in field ? field.max : undefined} defaultValue={candidate?.[field.name] ?? ""} aria-invalid={!!state.fieldErrors?.[field.name]} aria-describedby={state.fieldErrors?.[field.name] ? `${field.name}-error-${suffix}` : undefined} />
            {state.fieldErrors?.[field.name] && <p id={`${field.name}-error-${suffix}`} className="text-destructive text-sm">{state.fieldErrors[field.name]}</p>}
          </div>)}
          {[
            { name: "health_status", label: "Sức khỏe", options: Object.entries(HEALTH_STATUSES), value: candidate?.health_status },
            { name: "source", label: "Nguồn", options: Object.entries(CANDIDATE_SOURCES), value: candidate?.source },
            { name: "assignee_id", label: "Người phụ trách", options: assignees.filter(a => a.is_active || a.id === candidate?.assignee_id).map(a => [a.id, `${a.full_name}${a.is_active ? "" : " (ngừng hoạt động)"}`]), value: candidate?.assignee_id ?? (assignees.some(a => a.id === actorId && a.is_active) ? actorId : "") },
          ].map(field => <div key={field.name} className="space-y-1.5">
            <Label htmlFor={`${field.name}-${suffix}`}>{field.label} *</Label>
            <select id={`${field.name}-${suffix}`} name={field.name} required defaultValue={field.value ?? ""} aria-invalid={!!state.fieldErrors?.[field.name]} aria-describedby={state.fieldErrors?.[field.name] ? `${field.name}-error-${suffix}` : undefined} className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
              <option value="" disabled>Chọn {field.label.toLowerCase()}</option>
              {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {state.fieldErrors?.[field.name] && <p id={`${field.name}-error-${suffix}`} className="text-destructive text-sm">{state.fieldErrors[field.name]}</p>}
          </div>)}
        </div>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><SubmitButton>Lưu ứng viên</SubmitButton></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
