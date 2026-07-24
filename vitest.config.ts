import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Playwright (tests/e2e) chạy bằng runner riêng — đừng để Vitest nuốt nó
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],

    /* `UX-UIUX-M19-008` — chặn suite unit đỏ giả (user chốt 2026-07-23).
     *
     * Triệu chứng: full suite ra 218/220 ở 3 lượt, 220/220 ở 1 lượt; file đỏ
     * ĐỔI MỖI LƯỢT và luôn là timeout 5000ms chứ không phải sai kết quả.
     *
     * Đã đo từng file trước khi đụng config, đúng yêu cầu của user: test chậm
     * nhất **1144ms**, cách ngưỡng 5000ms tới 4,4 lần — **không file nào là thủ
     * phạm**. Chi phí nằm ở chỗ khác: máy này có 20 CPU nên Vitest mở tới 20
     * worker, mỗi worker dựng riêng một jsdom; tổng thời gian `environment`
     * cộng dồn **379,77s** trong khi wall-clock chỉ **49,64s**.
     *
     * Vì sao giới hạn worker chứ không nâng `testTimeout`: nâng ngưỡng chỉ nới
     * chỗ chờ, không làm test chạy nhanh hơn, và sẽ che mất một test thật sự
     * chậm bất thường sau này. Giới hạn worker thì mỗi test được nhiều CPU hơn
     * — đo được **thời gian chạy test thực giảm 45%** (42,84s → 23,68s), tức
     * khoảng an toàn tới ngưỡng 5000ms rộng ra thật sự.
     *
     * Đánh đổi đã biết và chấp nhận: tổng thời gian chờ tăng ~50s → ~86s. */
    maxWorkers: 4,
  },
});
