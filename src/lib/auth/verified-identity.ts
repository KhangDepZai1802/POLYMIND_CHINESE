import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type ClaimsAuthClient = Pick<SupabaseClient<Database>["auth"], "getClaims">;

export type VerifiedIdentity = {
  id: string;
  email: string;
};

// Chỉ kiểm định dạng cột Postgres UUID; không ép version/variant vì seed local
// dùng UUID xác định trước (ví dụ 1111…), vẫn hoàn toàn hợp lệ với auth.users.
const SUPABASE_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Xác minh JWT do Supabase Auth phát hành bằng `getClaims()`.
 *
 * Với signing key bất đối xứng (production dùng ES256), SDK kiểm chữ ký bằng
 * JWKS được cache nên không đặt Auth server trên critical path. Hàm luôn
 * fail-closed: SDK báo lỗi, thiếu claims hoặc `sub` không phải UUID đều bị từ
 * chối. Role/quyền không lấy từ JWT mà tiếp tục đọc từ `profiles` + RLS.
 */
export async function getVerifiedIdentity(
  auth: ClaimsAuthClient,
): Promise<VerifiedIdentity | null> {
  try {
    const { data, error } = await auth.getClaims();
    if (error || !data) return null;

    const { sub, email } = data.claims;
    if (typeof sub !== "string" || !SUPABASE_USER_ID.test(sub)) return null;

    return {
      id: sub,
      email: typeof email === "string" ? email : "",
    };
  } catch {
    return null;
  }
}
