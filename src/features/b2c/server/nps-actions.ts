"use server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/session";
import type { NpsAdminModel } from "../domain/nps";
import { permissionRpc } from "./permission-rpc";

export async function readNpsAdminAction(input: unknown) {
  await requireManager();
  const v = z.object({ surveyId: z.uuid().nullable(), page: z.number().int().min(0).max(1000000), query: z.string().trim().max(200), surveyPage: z.number().int().min(0).max(1000000), responsePage: z.number().int().min(0).max(1000000) }).parse(input);
  return permissionRpc<NpsAdminModel>("read_b2c_nps_admin", { p_survey_id: v.surveyId, p_page: v.page, p_query: v.query, p_survey_page: v.surveyPage, p_response_page: v.responsePage });
}
export async function findNpsClassesAction(query: string, page: number) {
  await requireManager();
  const v = z.object({ query: z.string().trim().max(200), page: z.number().int().min(0).max(1000000) }).parse({ query, page });
  return permissionRpc<{ rows: { id: string; code: string; name: string }[]; total: number }>("find_b2c_nps_classes", { p_query: v.query, p_page: v.page });
}
export async function saveNpsSurveyAction(input: unknown) {
  await requireManager();
  const p = z.object({ request_id: z.uuid(), id: z.uuid().nullable(), class_id: z.uuid(), title: z.string().trim().min(1).max(200), status: z.enum(["open", "closed"]), expires_on: z.iso.date(), expected_updated_at: z.string().nullable() }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Kiểm tra lớp và hạn khảo sát." };
  try {
    const { expires_on, ...v } = p.data;
    const id = await permissionRpc<string>("save_b2c_nps_survey", { p_data: { ...v, expires_at: new Date(`${expires_on}T23:59:59+07:00`).toISOString() } });
    revalidatePath("/admin/b2c/nps"); return { id };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không lưu được khảo sát." }; }
}
export async function issueNpsInvitationAction(surveyId: string, parentId: string, expectedUpdatedAt: string | null) {
  await requireManager();
  const v = z.object({ surveyId: z.uuid(), parentId: z.uuid(), expectedUpdatedAt: z.string().nullable() }).parse({ surveyId, parentId, expectedUpdatedAt });
  const token = randomBytes(32).toString("hex");
  await permissionRpc("issue_b2c_nps_invitation", { p_survey_id: v.surveyId, p_parent_id: v.parentId, p_expected_updated_at: v.expectedUpdatedAt, p_token_hash: createHash("sha256").update(token).digest("hex") });
  revalidatePath("/admin/b2c/nps");
  return { token };
}
export async function revokeNpsInvitationAction(id: string, expectedUpdatedAt: string) {
  await requireManager();
  const v = z.object({ id: z.uuid(), expectedUpdatedAt: z.string() }).parse({ id, expectedUpdatedAt });
  await permissionRpc("revoke_b2c_nps_invitation", { p_id: v.id, p_expected_updated_at: v.expectedUpdatedAt });
  revalidatePath("/admin/b2c/nps");
}
