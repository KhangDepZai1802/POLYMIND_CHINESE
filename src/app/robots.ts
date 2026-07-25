import type { MetadataRoute } from "next";

/**
 * Toàn bộ ứng dụng nằm sau đăng nhập nên vốn không có gì để lập chỉ mục.
 *
 * `/t/` được liệt kê tường minh vì đó là khu vực DUY NHẤT bot vào được: mã QR
 * là đường vào cho học sinh cầm sách, không phải để tìm thấy qua Google. Mã lọt
 * vào chỉ mục là mất luôn tác dụng của việc chọn mã khó đoán.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/", "/t/"] }],
  };
}
