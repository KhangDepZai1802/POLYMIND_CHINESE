import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * Đọc `.env.perf.local` nếu có, để khỏi phải gõ mật khẩu vào dòng lệnh.
 *
 * Lý do tồn tại: cú pháp `PERF_USER=... npm run ...` là của Bash và **báo lỗi
 * trên PowerShell** — mà máy làm việc của dự án này chạy Windows. Đưa vào file
 * thì cả hai shell đều chạy được một lệnh giống hệt nhau, và mật khẩu không
 * nằm lại trong lịch sử lệnh của terminal.
 *
 * File nằm trong `.env*` của `.gitignore` (dòng 50) nên KHÔNG lên git.
 * Biến đã có sẵn trong môi trường luôn được ưu tiên hơn file.
 */
function loadPerfEnvFile() {
  let raw: string;
  try {
    raw = readFileSync(".env.perf.local", "utf8");
  } catch {
    return; // không có file thì thôi — dùng biến môi trường như cũ
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    // `.trim()` ở đây KHÔNG phải cho đẹp: `CRON_SECRET` trên Vercel đã một lần
    // chặn cứng deploy chỉ vì dính khoảng trắng lúc dán. Bỏ luôn dấu nháy nếu
    // người dùng quen thói bọc giá trị.
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && /^["']$/.test(value[0]!)) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadPerfEnvFile();

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
