import { z } from "zod";

export const MONTHLY_COMMENT_FIELDS = {
  attendance: "Chuyên cần",
  attitude: "Thái độ học tập",
  learning: "Nội dung và tiến bộ trong tháng",
  strengths: "Điểm mạnh",
  improvements: "Nội dung cần cải thiện",
  next_plan: "Kế hoạch tháng tới / phối hợp phụ huynh",
} as const;
export type MonthlyCommentContent = Record<keyof typeof MONTHLY_COMMENT_FIELDS, string>;
export const monthlyCommentSchema = z.object({
  request_id: z.uuid(), class_id: z.uuid(), enrollment_id: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  expected_updated_at: z.string().nullable(), status: z.enum(["draft", "ready"]),
  content: z.object({ attendance: z.string().trim().max(1000), attitude: z.string().trim().max(1000), learning: z.string().trim().max(1000), strengths: z.string().trim().max(1000), improvements: z.string().trim().max(1000), next_plan: z.string().trim().max(1000) }),
}).refine((v) => v.status === "draft" || Object.values(v.content).every(Boolean), { message: "Nhập đủ các mục của mẫu trước khi hoàn tất." });

export function formatMonthlyComment(input: { fullName: string; className: string; month: string; content: MonthlyCommentContent; teacher: string }) {
  const [year, month] = input.month.split("-");
  return [
    `NHẬN XÉT THÁNG ${month}/${year}`,
    `Kính gửi Quý phụ huynh của học viên ${input.fullName},`,
    `Lớp: ${input.className}`,
    ...Object.entries(MONTHLY_COMMENT_FIELDS).map(([key, label]) => `${label}: ${input.content[key as keyof MonthlyCommentContent]}`),
    `Giáo viên/người nhận xét: ${input.teacher}`,
    "Trân trọng.",
  ].join("\n\n");
}

export type MonthlyCommentReport = {
  id: string; status: "draft" | "ready"; content: MonthlyCommentContent; updated_at: string; author_name: string;
};
export type MonthlyCommentStudent = {
  enrollment_id: string; student_code: string; full_name: string; report: MonthlyCommentReport | null;
  last_delivery: { channel: "zalo" | "email"; recipient_name: string; destination: string; created_at: string; report_updated_at: string } | null;
};
export type MonthlyCommentsModel = { rows: MonthlyCommentStudent[]; total: number };
