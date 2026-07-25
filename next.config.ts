import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
      {
        // Trang flashcard công khai cho mã QR in trong sách (`D-36`).
        source: "/t/:path*",
        headers: [
          // Thu hồi phải có hiệu lực TỨC THÌ. Để proxy/CDN giữ lại bản cũ thì
          // mã QR đã bị gỡ vẫn mở ra nội dung như thường.
          { key: "Cache-Control", value: "no-store" },
          // Lớp thứ hai ngoài `metadata.robots` và `robots.ts`: mã lọt vào chỉ
          // mục tìm kiếm là mất luôn tác dụng của việc chọn mã khó đoán.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
