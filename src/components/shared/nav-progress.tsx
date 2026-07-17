"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thanh tiến trình mảnh ở đỉnh màn hình, hiện khi điều hướng.
 *
 * Vì sao cần: trên gói serverless free, request đầu có thể mất ~1s (cold start).
 * Nếu bấm xong không có gì nhúc nhích, người dùng tưởng web treo. Thanh này báo
 * "đang xử lý" ngay lập tức.
 *
 * Kích hoạt bằng 2 nguồn:
 *  - Bấm vào `<a>` nội bộ (bắt ở capture phase) — cho mọi `<Link>`.
 *  - Sự kiện `window` "navstart" — cho điều hướng bằng `router.push` (filter,
 *    picker…). Xem `useNavProgress`.
 * Hoàn tất khi `pathname` hoặc `searchParams` đổi (trang mới đã render).
 *
 * Trạng thái chạy giữ trong ref (không phải state) để hàm trong effect chạy-một-
 * lần không đọc phải giá trị stale.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const runningRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    function clearTimers() {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    }

    function start() {
      if (runningRef.current) return;
      runningRef.current = true;
      clearTimers();
      setVisible(true);
      setProgress(8);
      // Bò dần tới ~90% để luôn có cảm giác tiến triển, chừa 10% cho lúc xong.
      trickleRef.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.12)));
      }, 220);
      // An toàn: nếu điều hướng bị hủy / không đổi URL, tự tắt sau 12s.
      timeoutsRef.current.push(setTimeout(done, 12000));
    }

    function done() {
      if (!runningRef.current) return;
      runningRef.current = false;
      clearTimers();
      setProgress(100);
      timeoutsRef.current.push(
        setTimeout(() => setVisible(false), 220),
        setTimeout(() => setProgress(0), 460),
      );
    }

    function onDocClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Chỉ tính là điều hướng khi URL thực sự đổi.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    }

    document.addEventListener("click", onDocClick, true);
    window.addEventListener("navstart", start);
    window.addEventListener("navdone", done);

    return () => {
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener("navstart", start);
      window.removeEventListener("navdone", done);
      clearTimers();
    };
    // Chủ đích chỉ gắn listener một lần.
  }, []);

  // URL đã đổi → trang mới đã tới → hoàn tất.
  useEffect(() => {
    window.dispatchEvent(new Event("navdone"));
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5"
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang"
    >
      <div
        className="from-primary via-info to-brand-red h-full bg-gradient-to-r transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
