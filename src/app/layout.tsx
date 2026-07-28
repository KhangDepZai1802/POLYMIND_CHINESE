import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "POLYMIND CHINESE",
    template: "%s · POLYMIND CHINESE",
  },
  description: "Hệ thống quản lý học viên tiếng Trung",
};

/**
 * Chạy function ở Tokyo — CẠNH DATABASE.
 *
 * Supabase của project này ở `ap-northeast-1` (Tokyo). Mặc định của Vercel là
 * `iad1` (Washington DC), nên mỗi round-trip xuống DB tốn ~150–170ms và một
 * trang có 2–3 round-trip NỐI TIẾP. Đo thật trước khi sửa: `/api/health` —
 * route không đụng DB một dòng nào — TTFB **474–486ms** từ Việt Nam.
 *
 * Chọn Tokyo chứ không Singapore (gần user hơn) vì một lần render có NHIỀU
 * round-trip xuống DB nhưng chỉ MỘT lượt trả về user: ngồi cạnh DB thắng.
 *
 * 🔴 `"regions"` trong `vercel.json` **KHÔNG có tác dụng với project Next.js** —
 * đã thử và đo: commit `5123e3e` có `"regions": ["hnd1"]`, deploy thành công
 * (QR link lên 200), nhưng `X-Vercel-Id` vẫn trả `hkg1::iad1::`. Next.js build
 * qua Build Output API và Vercel bỏ qua field đó. Cơ chế đúng là segment config
 * này — đặt ở root layout thì mọi segment con thừa kế.
 *
 * ⚠️ Đây là NỬA thứ nhất. Nửa thứ hai nằm ngoài repo: Vercel → Project Settings
 * → Functions → **Function Region = Tokyo (hnd1)**, vì Route Handler (`/api/*`)
 * không thừa kế từ layout. Sửa một nửa thì `/api/cron` vẫn chạy ở Mỹ.
 *
 * Kiểm chứng sau khi deploy — phải thấy `hnd1`, không phải `iad1`:
 *   curl -sD - -o /dev/null https://www.polymind.vn/api/health | grep -i x-vercel-id
 */
export const preferredRegion = "hnd1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
