"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { PARENT_RELATIONSHIPS, PARENT_RELATIONSHIP_LABELS, type ParentRow } from "@/features/b2c/domain/parents";
import { saveB2CParentAction } from "@/features/b2c/server/actions";
import { useFormAction } from "@/lib/use-form-action";
export function ParentDialog({ parent, showLabel = false }: { parent?: ParentRow; showLabel?: boolean }) {
  const [open,setOpen] = useState(false);
  const { state, formAction } = useFormAction(saveB2CParentAction,{onSuccess:()=>setOpen(false)});
  const key = parent?.id ?? "new";
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{parent ? <Button variant={showLabel ? "outline" : "ghost"} size={showLabel ? "sm" : "icon"} aria-label={`Sửa phụ huynh ${parent.full_name}`}><Pencil className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />{showLabel && "Sửa"}</Button> : <Button><Plus className="size-4" aria-hidden />Thêm phụ huynh</Button>}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{parent ? "Sửa phụ huynh" : "Thêm phụ huynh"}</DialogTitle><DialogDescription>Một phụ huynh có thể liên kết với nhiều học viên.</DialogDescription></DialogHeader>
      <form action={formAction} className="space-y-4"><input type="hidden" name="id" value={parent?.id ?? ""} />
        <div className="space-y-2"><Label htmlFor={`name-${key}`}>Tên phụ huynh *</Label><Input id={`name-${key}`} name="full_name" required maxLength={200} defaultValue={parent?.full_name ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`phone-${key}`}>SĐT phụ huynh</Label><Input id={`phone-${key}`} name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Nhập đúng 10 chữ số" defaultValue={parent?.phone ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`zalo-${key}`}>Zalo</Label><Input id={`zalo-${key}`} name="zalo" maxLength={200} defaultValue={parent?.zalo ?? ""} placeholder="SĐT hoặc tên tài khoản Zalo" /></div>
        <div className="space-y-2"><Label htmlFor={`email-${key}`}>Email phụ huynh</Label><Input id={`email-${key}`} name="email" type="email" maxLength={254} defaultValue={parent?.email ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor={`relation-${key}`}>Quan hệ với con</Label><select id={`relation-${key}`} name="relationship" className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" defaultValue={parent?.children[0]?.relationship ?? "unknown"}>{PARENT_RELATIONSHIPS.map((value)=><option key={value} value={value}>{PARENT_RELATIONSHIP_LABELS[value]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor={`children-${key}`}>Mã học viên của các con</Label><Textarea id={`children-${key}`} name="student_codes" defaultValue={parent?.children.map((child)=>child.code).join(", ") ?? ""} placeholder="B2C-HV000001, B2C-HV000002" maxLength={20000} /><p className="text-muted-foreground text-xs">Lấy mã tại mục Học viên. Ngăn cách các mã bằng dấu phẩy; quan hệ đã chọn áp dụng cho các con trong danh sách này.</p></div>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}{state.fieldErrors && <p role="alert" className="text-destructive text-sm">{Object.values(state.fieldErrors).flat().join(" ")}</p>}
        <DialogFooter><SubmitButton>Lưu phụ huynh</SubmitButton></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
