import { z } from "zod";

export const CERTIFICATE_TYPE_SUGGESTIONS = ["Cambridge", "IELTS", "TOEIC", "TOEFL", "HSK", "HSKK", "YCT"] as const;
export const certificateResultSchema = z.object({
  request_id: z.uuid(), id: z.uuid().nullable(), expected_updated_at: z.string().nullable(), student_id: z.uuid(),
  certificate_type: z.string().trim().min(1, "Nhập loại chứng chỉ.").max(100),
  level: z.string().trim().max(100), score: z.string().trim().min(1, "Nhập điểm hoặc xếp loại trên kết quả.").max(100),
  exam_date: z.iso.date().refine((v) => v >= "1900-01-01"),
  marketing_allowed: z.boolean(), marketing_note: z.string().trim().max(500), notes: z.string().trim().max(2000),
});
export const certificateFiltersSchema = z.object({
  query: z.string().trim().max(200).default(""), certificateType: z.string().trim().max(100).default(""),
  from: z.union([z.literal(""), z.iso.date()]).default(""), to: z.union([z.literal(""), z.iso.date()]).default(""),
  marketing: z.enum(["all", "yes", "no"]).default("all"), archived: z.boolean().default(false),
  studentId: z.uuid().nullable().default(null), page: z.number().int().min(0).max(1000000).default(0),
}).refine((v) => !v.from || !v.to || v.from <= v.to, { message: "Ngày đến không được trước ngày từ." });
export type CertificateFilters = z.infer<typeof certificateFiltersSchema>;
export type CertificateStudent = { id: string; code: string; full_name: string };
export type CertificateResult = {
  id: string; student_id: string; student_code: string; full_name: string; certificate_type: string;
  level: string; score: string; exam_date: string; marketing_allowed: boolean; marketing_note: string;
  notes: string; is_archived: boolean; updated_at: string;
};
export type CertificateResultsModel = {
  rows: CertificateResult[]; total: number; student_count: number; marketing_count: number; type_count: number;
  types: string[]; student_filter: CertificateStudent | null;
};
export type CertificateMarketingRow = Pick<CertificateResult, "student_code" | "full_name" | "certificate_type" | "level" | "score" | "exam_date">;
