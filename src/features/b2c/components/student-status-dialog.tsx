"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getB2CProgram } from "@/features/b2c/domain/programs";
import { B2C_CUSTOMER_SOURCES, B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { B2C_LEARNING_GOALS, B2C_LEARNING_GOAL_LABELS } from "@/features/b2c/domain/learning-goal";
import { SubmitButton } from "@/components/shared/submit-button";
import { B2C_STUDENT_STATUSES, B2C_STUDENT_STATUS_LABELS, type B2CStudentStatus } from "@/features/b2c/domain/student-status";
import { updateB2CEnrollmentAction } from "@/features/b2c/server/actions";
import { useFormAction } from "@/lib/use-form-action";

export function B2CStudentStatusDialog({ enrollmentId, fullName, className, status, reason, programSlug, phone, salesperson, enrollmentDate, learningStartDate, tuitionEndDate, customerSource, referrerName, learningGoal, certificateGoal }: {
  learningGoal: string | null;
  certificateGoal: string | null;
  customerSource: string | null;
  referrerName: string | null;
  enrollmentId: string;
  fullName: string;
  className: string;
  status: B2CStudentStatus;
  reason: string | null;
  programSlug: string;
  phone: string | null;
  salesperson: string | null;
  enrollmentDate: string | null;
  learningStartDate: string | null;
  tuitionEndDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(status);
  const [source, setSource] = useState(customerSource ?? "");
  const [goal, setGoal] = useState(learningGoal ?? "");
  const { state, formAction } = useFormAction(updateB2CEnrollmentAction, {
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setSelected(status); setSource(customerSource ?? ""); setGoal(learningGoal ?? ""); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Sửa ghi danh ${fullName}`} title="Sửa ghi danh">
          <Pencil className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa ghi danh</DialogTitle>
          <DialogDescription>{fullName} · {className}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={enrollmentId} />
          <div className="space-y-2">
            <Label htmlFor={`goal-${enrollmentId}`}>Mục tiêu học</Label>
            <select id={`goal-${enrollmentId}`} name="learning_goal" value={goal} onChange={(e) => setGoal(e.target.value)} className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
              <option value="">Chưa xác định</option>
              {B2C_LEARNING_GOALS.map((value) => <option key={value} value={value}>{B2C_LEARNING_GOAL_LABELS[value]}</option>)}
            </select>
          </div>
          {goal === "certificate" ? <div className="space-y-2">
            <Label htmlFor={`certificate-${enrollmentId}`}>Chứng chỉ mục tiêu *</Label>
            <Input id={`certificate-${enrollmentId}`} name="certificate_goal" required maxLength={200} defaultValue={certificateGoal ?? ""} placeholder="Starters, Movers, Flyers, YCT 2, HSK 3…" />
          </div> : <input type="hidden" name="certificate_goal" value="" />}
          <div className="space-y-2">
            <Label htmlFor={`source-${enrollmentId}`}>Nguồn khách</Label>
            <select id={`source-${enrollmentId}`} name="customer_source" value={source} onChange={(e) => setSource(e.target.value)} className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
              <option value="">Chưa xác định</option>
              {B2C_CUSTOMER_SOURCES.map((value) => <option key={value} value={value}>{B2C_CUSTOMER_SOURCE_LABELS[value]}</option>)}
            </select>
          </div>
          {source === "referral" ? <div className="space-y-2">
            <Label htmlFor={`referrer-${enrollmentId}`}>Người giới thiệu *</Label>
            <Input id={`referrer-${enrollmentId}`} name="referrer_name" required maxLength={200} defaultValue={referrerName ?? ""} />
          </div> : <input type="hidden" name="referrer_name" value="" />}
          <div className="space-y-2">
            <Label htmlFor={`program-${enrollmentId}`}>Chương trình *</Label>
            <select id={`program-${enrollmentId}`} name="program_slug" required className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" defaultValue={programSlug}>
              <option value={programSlug}>{getB2CProgram(programSlug)?.title ?? "Chọn chương trình"}</option>
            </select>
            <p className="text-muted-foreground text-xs">Chương trình theo lớp đã ghi danh.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`phone-${enrollmentId}`}>SĐT *</Label>
            <Input id={`phone-${enrollmentId}`} name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required defaultValue={phone ?? ""} title="Nhập đúng 10 chữ số" />
            <p className="text-muted-foreground text-xs">SĐT dùng chung cho hồ sơ học viên ở các lớp.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sales-${enrollmentId}`}>Người chốt *</Label>
            <Input id={`sales-${enrollmentId}`} name="salesperson" required maxLength={200} defaultValue={salesperson ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`enrolled-${enrollmentId}`}>Ngày nhập học *</Label>
            <Input id={`enrolled-${enrollmentId}`} name="enrollment_date" type="date" required defaultValue={enrollmentDate ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`start-${enrollmentId}`}>Ngày bắt đầu học</Label>
              <Input id={`start-${enrollmentId}`} name="learning_start_date" type="date" defaultValue={learningStartDate ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`end-${enrollmentId}`}>Ngày hết phí</Label>
              <Input id={`end-${enrollmentId}`} name="tuition_end_date" type="date" defaultValue={tuitionEndDate ?? ""} />
            </div>
          </div>
          <Label htmlFor={`status-${enrollmentId}`}>Trạng thái HV</Label>
          <select id={`status-${enrollmentId}`} name="status" value={selected} onChange={(e) => setSelected(e.target.value as B2CStudentStatus)} className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
            {B2C_STUDENT_STATUSES.map((value) => <option key={value} value={value}>{B2C_STUDENT_STATUS_LABELS[value]}</option>)}
          </select>
          {selected === "withdrawn" ? <div className="space-y-2">
            <Label htmlFor={`reason-${enrollmentId}`}>Lý do nghỉ (nếu có)</Label>
            <Textarea id={`reason-${enrollmentId}`} name="withdrawal_reason" defaultValue={reason ?? ""} maxLength={1000} rows={3} />
          </div> : <input type="hidden" name="withdrawal_reason" value="" />}
          {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
          {state.fieldErrors && <p role="alert" className="text-destructive text-sm">{Object.values(state.fieldErrors).flat().join(" ")}</p>}
          <DialogFooter><SubmitButton>Lưu</SubmitButton></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
