import { defineConfig, devices } from "@playwright/test";

/**
 * Config RIÊNG cho bộ đo hiệu năng điều hướng (`tests/perf`).
 *
 * Cố ý KHÔNG dùng chung `playwright.config.ts`:
 *
 *  • `globalSetup` ở đó dọn fixture bằng service-role key của Supabase **local**
 *    (cần Docker). Bộ đo này phải chạy được lên **production**, nơi không có
 *    Docker và cũng KHÔNG được phép dọn dữ liệu gì.
 *  • `webServer` ở đó chạy `npm run dev`. Đo trên `next dev` là đo nhầm: dev
 *    biên dịch route theo yêu cầu và `<Link>` KHÔNG prefetch, nên số đo ra là
 *    thời gian biên dịch chứ không phải thời gian người dùng thật phải chờ.
 *
 * Đây là công cụ ĐO, không phải bài kiểm — nó không assert gì về sản phẩm và
 * không bao giờ được để đỏ CI. `npm run test:e2e` không thấy nó (khác `testDir`).
 */
const baseURL = process.env.PERF_BASE_URL ?? "https://www.polymind.vn";

export default defineConfig({
  testDir: "./tests/perf",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Một lượt đo = login + (số bề mặt × số vòng) lần điều hướng. Với 13 bề mặt ×
  // 3 vòng trên đường truyền chậm, 30s mặc định là quá chặt.
  timeout: 15 * 60_000,
  reporter: "list",
  use: {
    baseURL,
    // Đo phải sạch cache giữa các lượt chạy — không tái dùng storageState.
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
