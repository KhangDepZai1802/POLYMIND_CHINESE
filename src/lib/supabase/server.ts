import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client cho RSC / Server Action / Route Handler.
 *
 * Dùng publishable key + cookie phiên → **RLS vẫn được áp dụng** theo đúng
 * người đang đăng nhập. Đây là client mặc định cho MỌI nghiệp vụ.
 *
 * Muốn bypass RLS? Xem `admin.ts` — và đọc kỹ cảnh báo ở đó trước.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Gọi từ RSC: không set cookie được. Bỏ qua an toàn —
            // middleware đã lo việc refresh session.
          }
        },
      },
    },
  );
}
