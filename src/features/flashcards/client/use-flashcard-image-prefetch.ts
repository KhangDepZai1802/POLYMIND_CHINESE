"use client";

import { useEffect } from "react";

import {
  flashcardPrefetchUrls,
  type FlashcardPrefetchPage,
} from "@/features/flashcards/domain/image-prefetch";

/**
 * TẢI TRƯỚC ẢNH CỦA CÁC THẺ LÂN CẬN (`PERF-IMG-1`).
 *
 * Phần chạm trình duyệt của `domain/image-prefetch.ts`. Dùng CHUNG cho màn Ôn
 * tập và trang QR `/t/<mã>` — hai trình đọc đã cùng gọi một `FlashcardSurface`,
 * viết hai bản tải trước ở đây là mở lại đúng cái cửa `BUG_M10_01` mà cả
 * `flashcard-surface.tsx` lẫn `flashcard-face.tsx` đang dán biển cấm.
 *
 * Cơ chế là `new Image()` chứ không phải `<link rel="preload">`: URL đã ký thay
 * đổi theo từng lượt tải trang, mà thẻ `<link>` thì phải nằm trong `<head>` lúc
 * dựng trang. `new Image()` đi thẳng vào **cùng một** bộ nhớ đệm ảnh của trình
 * duyệt, nên khi `next/image` dựng thẻ `<img>` cùng URL thì nó không phát sinh
 * request mới — đó chính là chỗ thời gian chờ biến mất.
 */

/**
 * URL đã bắn đi rồi thì không bắn lại — kể cả sau khi component unmount (đổi
 * buổi, bấm ✕ rồi vào lại). Để ở phạm vi module chính vì lý do đó.
 */
const requested = new Set<string>();

/**
 * Giữ tham chiếu tới ảnh đang bay.
 *
 * Bỏ tham chiếu ngay thì đối tượng `Image` thành rác và một số trình duyệt huỷ
 * luôn request đang dở — tải trước sẽ im lặng không có tác dụng gì. Xoá khi
 * xong (`load`/`error`) để không giữ ảnh trong bộ nhớ mãi.
 */
const inFlight = new Set<HTMLImageElement>();

/** Chặn trên cho `requested`: một phiên ôn dài đổi qua nhiều buổi vẫn có trần. */
const MAX_TRACKED_URLS = 2000;

/**
 * Trần chờ thẻ đang xem — LƯỚI AN TOÀN, không phải nhịp bình thường.
 *
 * Chỉ để phòng ca `<img>` không bao giờ báo `load` lẫn `error` (máy chủ treo
 * giữa chừng): thiếu nó thì việc tải trước ngừng hẳn cho tới khi rời thẻ.
 *
 * 🔴 Đặt 5s là SAI, đo ra rồi mới thấy: ảnh chưa nén ở 4G mất ~40 giây, nên
 * trần 5s biến "nhường đường" thành "chen ngang sau 5 giây" — thẻ 1 chậm thêm
 * 14 giây so với bản không tải trước. Với ảnh đã nén thì con số này không bao
 * giờ chạm tới.
 */
const MAX_WAIT_FOR_CURRENT_MS = 30000;

/**
 * NGÂN SÁCH THỜI GIAN cho một lượt tải trước — cái phanh thật của cơ chế này.
 *
 * Vì sao đo bằng THỜI GIAN chứ không bằng BYTE: ảnh nằm ở tên miền Supabase,
 * khác tên miền trang. Không có `Timing-Allow-Origin` thì `transferSize` /
 * `encodedBodySize` của `PerformanceResourceTiming` **luôn trả 0** cho tài
 * nguyên khác tên miền — một ngân sách tính bằng byte sẽ không bao giờ giảm, tức
 * không bao giờ phanh. Thời gian thì tự đo được, và nó chính là thứ học viên
 * cảm nhận.
 *
 * 8 giây: ảnh đã đổi WebP (~27KB) tải hết cả buổi 18 thẻ trong ~4 giây ở 4G, nên
 * ngân sách này không chạm tới. Ảnh chưa đổi (~3,8MB) thì hết ngay sau tấm đầu —
 * đúng ý: mạng yếu/ảnh nặng thì đừng ôm đồm.
 */
const PREFETCH_BUDGET_MS = 8000;

/**
 * Bao nhiêu ảnh tải trước cùng lúc.
 *
 * 🔴 Từng là 1 (tuần tự) — đúng cho thời ảnh còn 3,8MB, khi vấn đề là BĂNG
 * THÔNG và mọi luồng thêm vào đều cướp phần của thẻ đang xem. Đo trên production
 * sau khi đổi WebP thì vấn đề đổi hẳn bản chất: mỗi ảnh chỉ còn 27–63KB nhưng
 * vẫn tốn **~700ms** — gần như toàn bộ là ĐỘ TRỄ vòng tới máy chủ, không phải
 * byte. Tuần tự nghĩa là 18 thẻ × 700ms ≈ 12 giây, tức hết ngân sách trước khi
 * kịp phủ hết buổi.
 *
 * 🔴 ĐANG ĐỂ LẠI 1 (tuần tự). Bản 3 luồng làm **đỏ lặp lại được** bài E2E
 * `flashcard-responsive.spec.ts:351` ở CẢ HAI project — và đỏ cả khi chạy
 * `--workers=1`, nên không phải tranh chấp tài nguyên như những lượt nhiễu
 * trước đây. Chưa truy ra nguyên nhân, nên không đẩy lên: một tính năng tăng
 * tốc chưa hiểu rõ thì chưa đáng để đánh đổi một bài kiểm đang canh đúng thứ
 * user từng than (mọi nút phải thấy được ở 360×800).
 *
 * Việc còn bỏ ngỏ, có số đo sẵn để làm tiếp: mỗi ảnh nhỏ vẫn tốn ~700ms độ trễ
 * trên production, nên tuần tự chỉ phủ được ~11 thẻ trong ngân sách 8 giây.
 * Nâng lên 2–3 luồng là đúng hướng, nhưng phải hiểu bài kiểm kia đỏ vì sao trước.
 */
const PREFETCH_CONCURRENCY = 1;

function prefetchOne(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.decoding = "async";
    // Ưu tiên THẤP: thẻ đang xem phải xong trước. Thuộc tính này chưa có trong
    // kiểu DOM của TypeScript nên gán qua `assign`, không phải vì nó tuỳ tiện.
    Object.assign(image, { fetchPriority: "low" });
    const settle = () => {
      inFlight.delete(image);
      resolve();
    };
    image.addEventListener("load", settle, { once: true });
    image.addEventListener("error", settle, { once: true });
    inFlight.add(image);
    image.src = url;
  });
}

/**
 * Ảnh của thẻ ĐANG XEM đã tải xong chưa?
 *
 * `[data-face-side]` là mốc do `flashcard-surface.tsx` gắn cho hai mặt thẻ —
 * dùng lại chứ không tự đặt mốc mới. Không tìm thấy mặt nào (thẻ chữ thuần) thì
 * coi như xong, đúng nghĩa "không có ảnh nào phải chờ".
 */
function currentCardImagesSettled(): boolean {
  const images = document.querySelectorAll<HTMLImageElement>(
    "[data-face-side] img",
  );
  return Array.from(images).every((image) => image.complete);
}

export function useFlashcardImagePrefetch(
  pages: readonly FlashcardPrefetchPage[],
  index: number,
  options?: { enabled?: boolean; ahead?: number; behind?: number },
) {
  const enabled = options?.enabled ?? true;
  const ahead = options?.ahead;
  const behind = options?.behind;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const urls = flashcardPrefetchUrls(pages, index, { ahead, behind });
    if (urls.length === 0) return;

    let cancelled = false;

    /*
     * 🔴 NHƯỜNG ĐƯỜNG TRUYỀN CHO THẺ ĐANG XEM — đo được, không phải đề phòng suông.
     *
     * Bản đầu bắn cả 3–4 ảnh cùng lúc ngay khi đổi thẻ. Đo ở 4G giả lập (1,6
     * Mbps) với ảnh chưa nén: thẻ đang xem **quá 30 giây vẫn chưa hiện**, vì ba
     * ảnh tải trước chia nhau đúng cái băng thông mà nó đang cần. Tức là tính
     * năng sinh ra để hết chờ lại làm chờ lâu hơn — với đúng nhóm học viên mạng
     * yếu mà nó nhắm tới.
     *
     * Hai vế chữa: **chờ thẻ đang xem xong** rồi mới bắt đầu, và tải **tuần tự**
     * từng ảnh một. `fetchPriority: "low"` không đủ — nó chỉ xếp hạng trong một
     * kết nối, không ngăn việc chia băng thông.
     */
    const waitForCurrentCard = () =>
      new Promise<void>((resolve) => {
        const deadline = Date.now() + MAX_WAIT_FOR_CURRENT_MS;
        const tick = () => {
          if (cancelled || currentCardImagesSettled() || Date.now() > deadline) {
            resolve();
            return;
          }
          window.setTimeout(tick, 120);
        };
        tick();
      });

    void waitForCurrentCard().then(async () => {
      // `performance.now()` chứ không phải `Date.now()`: đồng hồ hệ thống nhảy
      // (đổi múi giờ, đồng bộ NTP) sẽ làm ngân sách âm hoặc vô hạn.
      const startedAt = performance.now();
      const queue = urls.filter((url) => !requested.has(url));

      await Promise.all(
        Array.from(
          { length: Math.min(PREFETCH_CONCURRENCY, queue.length) },
          async () => {
            while (queue.length > 0) {
              if (cancelled) return;
              // Ngân sách đo bằng đồng hồ treo tường, không cộng dồn từng ảnh:
              // với nhiều luồng chạy song song thì cộng dồn sẽ tiêu ngân sách
              // nhanh gấp mấy lần thời gian thật sự trôi qua.
              if (performance.now() - startedAt > PREFETCH_BUDGET_MS) return;

              const url = queue.shift();
              if (!url || requested.has(url)) continue;
              if (requested.size >= MAX_TRACKED_URLS) requested.clear();
              requested.add(url);
              await prefetchOne(url);
            }
          },
        ),
      );
    });

    // Rời thẻ/đổi buổi thì dừng hàng đợi. Ảnh đang bay vẫn về đích và vẫn nằm
    // trong cache — chỉ là không bắn thêm cái tiếp theo cho một thẻ không còn
    // ai xem.
    return () => {
      cancelled = true;
    };
  }, [pages, index, enabled, ahead, behind]);
}
