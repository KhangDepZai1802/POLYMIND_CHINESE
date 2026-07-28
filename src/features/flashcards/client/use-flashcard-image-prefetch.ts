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

    for (const url of flashcardPrefetchUrls(pages, index, { ahead, behind })) {
      if (requested.has(url)) continue;
      if (requested.size >= MAX_TRACKED_URLS) requested.clear();
      requested.add(url);

      const image = new window.Image();
      image.decoding = "async";
      // Ưu tiên THẤP: thẻ đang xem phải được tải xong trước, tải trước chỉ nên
      // dùng phần băng thông còn thừa. Thuộc tính này chưa có trong kiểu DOM của
      // TypeScript nên gán qua `assign`, không phải vì nó là thứ tuỳ tiện.
      Object.assign(image, { fetchPriority: "low" });
      const settle = () => {
        inFlight.delete(image);
      };
      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
      inFlight.add(image);
      image.src = url;
    }
  }, [pages, index, enabled, ahead, behind]);
}
