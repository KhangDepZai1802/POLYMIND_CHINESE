import { z } from "zod";

export const ENROLLMENT_EVENT_LABELS = {
  transfer: "Chuyển lớp",
  hold: "Bảo lưu",
  resume: "Đi học lại",
} as const;

export const enrollmentLifecycleSchema = z.object({
  request_id: z.uuid(),
  enrollment_id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  action: z.enum(["transfer", "hold", "resume"]),
  effective_date: z.iso.date(),
  expected_return_date: z.union([z.literal(""), z.iso.date()]),
  target_class_id: z.union([z.literal(""), z.uuid()]),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do.").max(1000),
}).superRefine((v, ctx) => {
  if (v.action === "transfer" && !v.target_class_id)
    ctx.addIssue({ code: "custom", path: ["target_class_id"], message: "Chọn lớp chuyển đến." });
  if (v.action !== "transfer" && v.target_class_id)
    ctx.addIssue({ code: "custom", path: ["target_class_id"], message: "Chỉ chuyển lớp mới chọn lớp đích." });
  if (v.expected_return_date && (v.action !== "hold" || v.expected_return_date < v.effective_date))
    ctx.addIssue({ code: "custom", path: ["expected_return_date"], message: "Ngày dự kiến học lại phải từ ngày bảo lưu." });
});

export type EnrollmentLifecycleContext = {
  enrollment: { id: string; status: string; updated_at: string; class_id: string };
  classes: { id: string; code: string; name: string }[];
  events: {
    id: string; action: keyof typeof ENROLLMENT_EVENT_LABELS;
    effective_date: string; expected_return_date: string | null;
    reason: string; actor_name: string; created_at: string;
    from_class_name: string; to_class_name: string | null;
  }[];
  total: number;
};
