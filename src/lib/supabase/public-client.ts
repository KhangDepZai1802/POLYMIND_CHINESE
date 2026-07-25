import "server-only";

import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client **MÙ COOKIE** — chỉ dùng cho trang công khai `/t/<mã>`.
 *
 * ⚠️ Vì sao phải có client riêng thay vì dùng `createClient()` của `server.ts`:
 *
 * Bề mặt công khai (`D-36`) được cấp cho vai **`anon`** và chỉ `anon`:
 *   - `public.get_public_flashcard_session` revoke khỏi `authenticated`;
 *   - policy Storage `flashcard_media_public_link_read` là `to anon`.
 *
 * Nếu trang công khai dùng client đọc cookie, thì một **giáo viên hoặc học viên
 * đang đăng nhập** quét mã QR sẽ gửi request với vai `authenticated` → RPC bị
 * từ chối và `signPaths()` trả Map rỗng → **ảnh và audio trắng trơn, không một
 * thông báo lỗi nào**. Đúng dạng hỏng im lặng mà `DS-049` cảnh báo.
 *
 * `getAll` trả mảng rỗng và `setAll` không làm gì: request đi ra KHÔNG mang
 * `Authorization` header của phiên, nên PostgREST luôn thấy vai `anon` bất kể
 * người xem đã đăng nhập hay chưa. Trang cũng vì thế mà không bao giờ đặt
 * cookie phiên cho khách vãng lai — có bài E2E đếm cookie `sb-*` để chứng minh.
 *
 * ⛔ KHÔNG dùng client này ở bất kỳ chỗ nào khác. Nó cố tình vứt bỏ danh tính.
 */
export function createPublicClient() {
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Không làm gì: trang công khai không có phiên để giữ.
        },
      },
    },
  );
}
