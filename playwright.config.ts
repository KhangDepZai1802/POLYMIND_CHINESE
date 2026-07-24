import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Dọn sạch MỌI dải fixture E2E trước khi suite bắt đầu. Mỗi spec chỉ xoá rác
  // của chính nó, nên một lượt chạy bị dừng giữa chừng để lại rác phá lượt chạy
  // kế tiếp ở spec KHÁC — chỗ duy nhất biết đủ về mọi fixture là đây.
  globalSetup: "./tests/e2e/global-setup.ts",
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
    // Chuyển tiếp log của `next dev` ra output của lượt chạy.
    //
    // Không phải để cho đẹp: `UX-UIUX-M00-025` là một truy vấn phía MÁY CHỦ
    // `throw` khiến trang rơi vào error boundary, và suốt hai đợt nó bị đọc
    // nhầm thành lỗi a11y của sản phẩm — một phần vì **không ai nhìn thấy log
    // của máy chủ**. Mặc định Playwright nuốt luôn stdout/stderr của webServer,
    // nên khi test đỏ thì vết duy nhất còn lại là phía trình duyệt.
    stdout: "pipe",
    stderr: "pipe",
  },
});
