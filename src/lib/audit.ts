import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { Json } from "@/types/database";

/**
 * Ghi audit cho một mutation nhạy cảm.
 *
 * Actor LUÔN là người đang đăng nhập — RPC `log_audit` lấy từ `auth.uid()`, không
 * nhận tham số actor. Không có cách nào ghi audit mạo danh người khác.
 *
 * Audit hỏng KHÔNG được làm hỏng nghiệp vụ: nếu ghi log thất bại, ta ghi ra
 * console rồi đi tiếp, chứ không rollback việc admin vừa làm.
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  params: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: Json;
    after?: Json;
  },
): Promise<void> {
  const { error } = await supabase.rpc("log_audit", {
    p_action: params.action,
    p_resource_type: params.resourceType,
    p_resource_id: params.resourceId ?? undefined,
    p_before: params.before ?? undefined,
    p_after: params.after ?? undefined,
  });

  if (error) {
    console.error("[audit] ghi log thất bại:", params.action, error.message);
  }
}
