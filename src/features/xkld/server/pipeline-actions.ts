"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import {
  XKLD_READ_ROLES,
  XKLD_EDIT_ROLES,
  CANDIDATES_PATH,
} from "@/features/xkld/domain/candidates";
import {
  PIPELINE_PATH,
  transitionSchema,
  type LinkedClass,
  type LinkedOrder,
  type SearchPage,
  type ProgressEvent,
} from "@/features/xkld/domain/pipeline";
export async function transitionCandidateAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(...XKLD_EDIT_ROLES);
  const parsed = transitionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const client = await createClient();
  const { error } = await client.rpc("transition_xkld_candidate", {
    p_candidate_id: v.candidate_id,
    p_stage: v.stage,
    p_order_id: v.order_id,
    p_b2c_class_id: v.b2c_class_id,
    p_expected_updated_at: v.expected_updated_at,
    p_request_id: v.request_id,
    p_note: v.note,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath(PIPELINE_PATH);
  revalidatePath(CANDIDATES_PATH);
  return { success: "Đã cập nhật pipeline." };
}
const lookup = z.object({
  q: z.string().trim().max(200),
  page: z.number().int().min(0).max(1000000),
});
export async function searchPipelineClassesAction(
  q: string,
  page: number,
): Promise<{ data?: SearchPage<LinkedClass>; error?: string }> {
  await requireRole(...XKLD_READ_ROLES);
  const parsed = lookup.safeParse({ q, page });
  if (!parsed.success) return { error: "Bộ lọc lớp không hợp lệ." };
  const { data, error } = await (
    await createClient()
  ).rpc("search_xkld_b2c_classes", {
    p_query: parsed.data.q,
    p_page: parsed.data.page,
  });
  return error
    ? { error: "Không tải được lớp B2C." }
    : { data: data as unknown as SearchPage<LinkedClass> };
}
export async function searchPipelineOrdersAction(
  q: string,
  page: number,
): Promise<{ data?: SearchPage<LinkedOrder>; error?: string }> {
  await requireRole(...XKLD_READ_ROLES);
  const parsed = lookup.safeParse({ q, page });
  if (!parsed.success) return { error: "Bộ lọc đơn hàng không hợp lệ." };
  const { data, error } = await (
    await createClient()
  ).rpc("search_xkld_pipeline_orders", {
    p_query: parsed.data.q,
    p_page: parsed.data.page,
  });
  return error
    ? { error: "Không tải được đơn hàng." }
    : { data: data as unknown as SearchPage<LinkedOrder> };
}
export async function getProgressHistoryAction(
  candidateId: string,
  page: number,
): Promise<{ data?: SearchPage<ProgressEvent>; error?: string }> {
  await requireRole(...XKLD_READ_ROLES);
  if (
    !z.uuid().safeParse(candidateId).success ||
    !z.number().int().min(0).max(1000000).safeParse(page).success
  )
    return { error: "Bộ lọc lịch sử không hợp lệ." };
  const { data, count, error } = await (
    await createClient()
  )
    .from("xkld_pipeline_history")
    .select(
      "id,created_at,from_stage,to_stage,old_order_code,new_order_code,old_class_label,new_class_label,actor_id,actor_name,note",
      { count: "exact" },
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 20, page * 20 + 19);
  return error
    ? { error: "Không tải được lịch sử chuyển bước." }
    : { data: { rows: data as ProgressEvent[], total: count ?? 0 } };
}
