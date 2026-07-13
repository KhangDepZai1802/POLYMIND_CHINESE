import { z } from "zod";

/**
 * Validate biến môi trường ngay lúc khởi động thay vì để `undefined` lan xuống
 * runtime rồi nổ ở một chỗ hoàn toàn không liên quan.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

/**
 * Chỉ đọc được các biến NEXT_PUBLIC_*. Gọi được ở cả client lẫn server.
 *
 * Phải viết `process.env.X` tường minh — Next.js thay thế biến ở build time
 * bằng cách quét text, nên `process.env[key]` động sẽ ra `undefined` ở client.
 */
export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Thiếu/sai biến môi trường public: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}. Xem .env.example.`,
    );
  }

  return parsed.data;
}

/**
 * Biến bí mật — CHỈ gọi từ server.
 *
 * Không có `import "server-only"` ở file này vì `getPublicEnv()` cần dùng được
 * ở client. Bảo vệ thật nằm ở chỗ khác: các biến này không có tiền tố
 * NEXT_PUBLIC_ nên Next.js KHÔNG bao giờ nhúng chúng vào bundle client —
 * ở client chúng luôn là `undefined`, và hàm này sẽ throw.
 */
export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });

  if (!parsed.success) {
    throw new Error(
      `Thiếu/sai biến môi trường server: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}. Xem .env.example.`,
    );
  }

  return parsed.data;
}
