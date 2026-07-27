import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * `ResizeObserver` — jsdom KHÔNG có, mà nó là API duyệt web bình thường.
 *
 * Bản giả này cố ý **không phát sự kiện nào**: jsdom không có layout engine nên
 * mọi `clientHeight`/`scrollHeight` đều bằng 0, tức không có gì thật để quan
 * sát. Bài kiểm nào cần đo kích thước thật thì phải là E2E (Playwright) —
 * `FitText` (thu cỡ chữ mặt sau thẻ) được đo ở
 * `tests/e2e/flashcard-responsive.spec.ts` chính vì lý do đó.
 *
 * Thiếu bản giả này thì component dùng `ResizeObserver` sẽ `throw` ngay lúc
 * mount và cả file test đỏ vì môi trường, không phải vì sản phẩm.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
