import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * ⚠️  ADMIN CLIENT — BYPASS TOÀN BỘ RLS.
 *
 * Client này dùng service_role key, nghĩa là nó ĐI XUYÊN QUA mọi policy RLS.
 * Nó không phải "client server mạnh hơn" — nó là chìa khóa vạn năng của database.
 *
 * ✅ ĐƯỢC dùng cho, và CHỈ cho:
 *      - Mời user (tạo auth.users)
 *      - Khóa / mở tài khoản
 *      - Đổi role
 *      - Seed
 *      - System cron đã xác thực, chỉ gọi RPC nền bị khóa cho service_role
 *    Đếm được trên đầu ngón tay. Tất cả đều là admin flow, server-only, và
 *    PHẢI tự kiểm quyền `super_admin` trước khi gọi.
 *
 * ❌ KHÔNG BAO GIỜ dùng để phục vụ request thường của teacher/student.
 *    Làm vậy là vô hiệu hóa toàn bộ RLS — chốt chặn cuối cùng của hệ thống.
 *    Cần đọc/ghi dữ liệu nghiệp vụ? Dùng `server.ts`.
 *
 * `import "server-only"` ở trên bảo đảm: lỡ import file này vào Client Component
 * thì BUILD SẼ FAIL — đúng như mong muốn, thà hỏng lúc build còn hơn rò key.
 */
export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
