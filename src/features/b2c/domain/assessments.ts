import { z } from "zod";

export const B2C_ASSESSMENT_TYPES = { midterm: "Giữa kỳ", final: "Cuối kỳ" } as const;
const base = { request_id: z.uuid(), class_id: z.uuid() };
export const b2cAssessmentSchema = z.object({
  ...base, id: z.uuid().nullable(), expected_updated_at: z.string().nullable(),
  title: z.string().trim().min(1, "Nhập tên bài kiểm tra.").max(200),
  kind: z.enum(["midterm", "final"]),
  exam_date: z.iso.date().refine((v) => v >= "1900-01-01"),
  max_score: z.number().positive().max(1000).multipleOf(0.01),
});
export const b2cAssessmentResultSchema = z.object({
  ...base, exam_id: z.uuid(), enrollment_id: z.uuid(), expected_updated_at: z.string().nullable(),
  score: z.number().min(0).max(1000).multipleOf(0.01).nullable(),
  feedback: z.string().trim().max(2000), reason: z.string().trim().max(1000),
}).refine((v) => !v.expected_updated_at || !!v.reason, { message: "Nhập lý do sửa kết quả.", path: ["reason"] });

export type B2CAssessment = { id: string; title: string; kind: keyof typeof B2C_ASSESSMENT_TYPES; exam_date: string; max_score: number; updated_at: string };
export type B2CAssessmentStudent = { enrollment_id: string; student_code: string; full_name: string; score: number | null; feedback: string; updated_at: string | null };
export type B2CAssessmentsModel = { exams: B2CAssessment[]; exam_total: number; selected: B2CAssessment | null; rows: B2CAssessmentStudent[]; total: number; graded: number };
export type B2CAssessmentHistory = { id: string; entity_type: "exam" | "result"; student_name: string | null; actor_name: string; created_at: string; reason: string; before_data: Record<string, string | number | null> | null; after_data: Record<string, string | number | null> };
