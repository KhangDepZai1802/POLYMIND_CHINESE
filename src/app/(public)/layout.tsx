import type { Viewport } from "next";

import "./public-flashcard.css";

/**
 * Vỏ của khu vực CÔNG KHAI — không đăng nhập, không phân quyền.
 *
 * ⚠️ Phải nằm NGOÀI `(dashboard)`: layout đó gọi `requireUser()` nên mọi trang
 * bên trong đều bắt buộc đăng nhập, bất kể middleware nói gì.
 *
 * Không sidebar, không `UserMenu`, không `NotificationBell` — khách vãng lai
 * không có gì trong đó, và mỗi component thừa là một cơ hội kéo nhầm một
 * server action vào bundle công khai.
 */

/**
 * 🔴 `viewportFit: "cover"` — thiếu nó thì `env(safe-area-inset-*)` LUÔN trả 0
 * trên iOS, và mọi tính toán tai thỏ / thanh gesture trong CSS im lặng vô hiệu:
 * code trông đúng nhưng chạy sai.
 *
 * Cố ý khai ở đây chứ KHÔNG ở root layout. Bật toàn cục là chuyển toàn bộ khu
 * dashboard sang edge-to-edge — đổi bố cục 13 màn mà không ai yêu cầu.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // KHÔNG đặt maximumScale/userScalable: chặn phóng to là vi phạm WCAG 1.4.4.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
