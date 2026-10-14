"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToMessage, zodToActionState, type ActionState } from "@/lib/action-state";
import { candidateSchema, CANDIDATES_PATH, XKLD_EDIT_ROLES } from "@/features/xkld/domain/candidates";
import { PIPELINE_PATH } from "@/features/xkld/domain/pipeline";

export async function saveCandidateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireRole(...XKLD_EDIT_ROLES);
  const parsed = candidateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { id, create_request_id, updated_at, ...values } = parsed.data;
  const client = await createClient();
  const result = id
    ? await client.from("xkld_candidates").update(values).eq("id", id).eq("updated_at", updated_at).select("id").maybeSingle()
    : await client.from("xkld_candidates").upsert({ ...values, create_request_id }, { onConflict: "create_request_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (result.error) return { error: dbErrorToMessage(result.error) };
  if (!result.data) {
    if (id) return { error: "Hồ sơ đã được người khác cập nhật hoặc không còn quyền sửa. Tải lại trang trước khi sửa tiếp." };
    const { data, error } = await client.from("xkld_candidates").select("id").eq("create_request_id", create_request_id).eq("created_by", actor.id).maybeSingle();
    if (error || !data) return { error: "Không lưu được ứng viên. Vui lòng thử lại." };
  }
  revalidatePath(CANDIDATES_PATH);
  revalidatePath(PIPELINE_PATH);
  return { success: id ? "Đã cập nhật ứng viên." : "Đã thêm ứng viên." };
}
