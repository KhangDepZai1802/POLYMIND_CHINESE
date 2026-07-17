"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Điều hướng bằng code (filter, picker, tab…) KÈM báo hiệu loading.
 *
 * `router.push` trần không cho biết gì trong lúc trang mới đang render trên
 * server → giao diện như treo. Hook này:
 *  - phát `navstart` để thanh tiến trình toàn cục hiện ngay, và
 *  - trả `isPending` để control tự khóa/hiện spinner cho tới khi xong.
 *
 * Dùng `navigate` thay cho `router.push`; giữ nguyên state trong URL.
 */
export function useNavProgress() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string, opts?: { replace?: boolean }) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("navstart"));
    }
    startTransition(() => {
      if (opts?.replace) router.replace(href);
      else router.push(href);
    });
  }

  return { navigate, isPending };
}
