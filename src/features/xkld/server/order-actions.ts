"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { XKLD_EDIT_ROLES } from "@/features/xkld/domain/candidates";
import { PIPELINE_PATH } from "@/features/xkld/domain/pipeline";
import {
  marketSchema,
  orderSchema,
  ORDERS_PATH,
} from "@/features/xkld/domain/orders";

export async function saveMarketAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(...XKLD_EDIT_ROLES);
  const parsed = marketSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { id, create_request_id, updated_at, ...values } = parsed.data;
  const client = await createClient();
  const result = id
    ? await client
        .from("xkld_markets")
        .update(values)
        .eq("id", id)
        .eq("updated_at", updated_at)
        .select("id")
        .maybeSingle()
    : await client
        .from("xkld_markets")
        .upsert(
          { ...values, create_request_id },
          { onConflict: "create_request_id", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
  if (result.error)
    return {
      error:
        result.error.code === "23505"
          ? "Quốc gia hoặc mã quốc gia đã tồn tại."
          : dbErrorToMessage(result.error),
    };
  if (!result.data) {
    if (id)
      return {
        error:
          "Thị trường đã thay đổi. Vui lòng tải lại trang trước khi sửa tiếp.",
      };
    const { data, error } = await client
      .from("xkld_markets")
      .select("id")
      .eq("create_request_id", create_request_id)
      .eq("created_by", actor.id)
      .maybeSingle();
    if (error || !data) return { error: "Không lưu được thị trường." };
  }
  revalidatePath(ORDERS_PATH);
  return { success: id ? "Đã cập nhật thị trường." : "Đã thêm thị trường." };
}

export async function saveOrderAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(...XKLD_EDIT_ROLES);
  const parsed = orderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { id, create_request_id, updated_at, ...values } = parsed.data;
  const client = await createClient();
  const result = id
    ? await client
        .from("xkld_orders")
        .update(values)
        .eq("id", id)
        .eq("updated_at", updated_at)
        .select("id")
        .maybeSingle()
    : await client
        .from("xkld_orders")
        .upsert(
          { ...values, create_request_id },
          { onConflict: "create_request_id", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
  if (result.error) return { error: dbErrorToMessage(result.error) };
  if (!result.data) {
    if (id)
      return {
        error:
          "Đơn hàng đã thay đổi. Vui lòng tải lại trang trước khi sửa tiếp.",
      };
    const { data, error } = await client
      .from("xkld_orders")
      .select("id")
      .eq("create_request_id", create_request_id)
      .eq("created_by", actor.id)
      .maybeSingle();
    if (error || !data) return { error: "Không lưu được đơn hàng." };
  }
  revalidatePath(ORDERS_PATH);
  revalidatePath(PIPELINE_PATH);
  return { success: id ? "Đã cập nhật đơn hàng." : "Đã thêm đơn hàng." };
}
