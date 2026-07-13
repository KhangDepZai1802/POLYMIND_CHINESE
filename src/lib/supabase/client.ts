import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client cho Client Component (trình duyệt).
 *
 * Dùng publishable key → **RLS luôn được áp dụng**. Đây là điều mong muốn:
 * kể cả người dùng mở DevTools gọi thẳng Supabase, họ vẫn chỉ đọc/ghi được
 * đúng phần dữ liệu RLS cho phép.
 */
export function createClient() {
  const env = getPublicEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
