import { z } from "zod";
export const NPS_QUESTION = "Anh/chị có sẵn lòng giới thiệu trung tâm cho bạn bè, người thân không?";
export const npsResponseSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/), request_id: z.uuid(),
  score: z.number().int().min(0).max(10), reason: z.string().trim().max(2000), teacher_feedback: z.string().trim().max(2000), service_feedback: z.string().trim().max(2000),
});
export function npsGroup(score: number) {
  if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("Điểm NPS phải từ 0 đến 10.");
  return score >= 9 ? "Sẵn lòng giới thiệu" : score >= 7 ? "Trung lập" : "Chưa hài lòng";
}
export type NpsSurvey = { id: string; class_id: string; title: string; status: "open" | "closed"; expires_at: string; updated_at: string; class_code: string; class_name: string };
export type NpsParent = { parent_id: string; parent_name: string; zalo: string | null; email: string | null; children: string; invite_id: string | null; invite_updated_at: string | null; revoked: boolean; score: number | null; answered_at: string | null };
export type NpsAdminModel = {
  surveys: NpsSurvey[]; survey_total: number; selected: NpsSurvey | null;
  rows: NpsParent[]; total: number; unlinked_students: number;
  stats: { responses: number; invitations: number; promoters: number; passives: number; detractors: number; nps: number | null };
  responses: { id: string; parent_name: string; score: number; reason: string; teacher_feedback: string; service_feedback: string; created_at: string }[]; response_total: number;
};
export type PublicNpsForm = { state: "open" | "invalid" | "closed" | "expired" | "submitted"; title?: string; class_name?: string; expires_at?: string };
