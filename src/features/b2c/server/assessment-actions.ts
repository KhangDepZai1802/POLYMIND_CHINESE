"use server";
import { z } from "zod";
import { revalidateB2CViews } from "./revalidate-views";
import { requireTeaching } from "@/lib/auth/session";
import { b2cAssessmentSchema, b2cAssessmentResultSchema, type B2CAssessmentsModel, type B2CAssessmentHistory } from "../domain/assessments";
import { permissionRpc } from "./permission-rpc";

export async function readB2CAssessmentsAction(input: unknown) {
  await requireTeaching("super_admin");
  const v = z.object({ classId: z.uuid(), examId: z.uuid().nullable(), page: z.number().int().min(0).max(1000000), examPage: z.number().int().min(0).max(1000000), query: z.string().trim().max(200) }).parse(input);
  return permissionRpc<B2CAssessmentsModel>("read_b2c_assessments", { p_class_id: v.classId, p_exam_id: v.examId, p_page: v.page, p_exam_page: v.examPage, p_query: v.query });
}
export async function readB2CAssessmentHistoryAction(examId: string, page: number) {
  await requireTeaching("super_admin");
  const v = z.object({ examId: z.uuid(), page: z.number().int().min(0).max(1000000) }).parse({ examId, page });
  return permissionRpc<{ rows: B2CAssessmentHistory[]; total: number }>("read_b2c_assessment_history", { p_exam_id: v.examId, p_page: v.page });
}
export async function saveB2CAssessmentAction(action: "exam" | "result", input: unknown) {
  await requireTeaching("super_admin");
  if (action !== "exam" && action !== "result") return { error: "Thao tác không hợp lệ." };
  const parsed = (action === "exam" ? b2cAssessmentSchema : b2cAssessmentResultSchema).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kiểm tra thông tin bài kiểm tra." };
  try {
    const id = await permissionRpc<string>("write_b2c_assessment", { p_action: action, p_data: parsed.data });
    revalidateB2CViews();
    return { id };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không lưu được. Vui lòng thử lại." }; }
}
