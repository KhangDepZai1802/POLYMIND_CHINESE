import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Các smoke test dùng chung Supabase local và tự dựng/dọn fixture. Chạy hai
  // project đồng thời khiến mobile xóa fixture của desktop (và ngược lại).
  fullyParallel: false,
  // Smoke chạy trên `next dev` (biên dịch route theo yêu cầu) và đụng DB thật:
  // một test dựng dữ liệu → thao tác → kiểm DB → dọn. Chạy song song nhiều worker
  // thì 30s mặc định là quá chặt và test đỏ vì HẾT GIỜ chứ không phải vì sai.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Giáo viên điểm danh trên điện thoại giữa buổi dạy — mobile là ca dùng thật,
    // không phải "nice to have".
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
