"use client";

import { ArrowDown, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * HƯỚNG DẪN MŨI TÊN cho nút "Bắt đầu ôn thẻ" (user chốt 2026-07-25).
 *
 * Bối cảnh quyết định — đáng ghi vì nó là một cặp lo ngại ngược nhau:
 *   • Vào module là nhảy thẳng vào flashcard toàn màn hình ⇒ *"những người kém
 *     công nghệ sẽ không biết sự tồn tại của chức năng Ôn Tập Câu Sai"*.
 *   • Nhưng nếu hiện trang có hai tab trước ⇒ *"tôi lại sợ người ta không biết
 *     cách làm mà cứ thế sử dụng rồi complain web tôi dỏm"*.
 * Chốt: hiện hai tab (thấy được cả hai chức năng) **và** chỉ đường vào flashcard
 * bằng một mũi tên động, có ✕ để tắt và có "Không nhắc lại".
 *
 * Ba luật của khối này:
 *   1. **Không che nút.** Hướng dẫn nằm NGAY TRÊN nút trong cùng luồng trang,
 *      không phải lớp phủ — một hướng dẫn mà chắn mất đúng cái nút nó đang chỉ
 *      là tự phá chính mình. Mũi tên `aria-hidden` vì chữ đã nói đủ.
 *   2. **Tôn trọng `prefers-reduced-motion`.** Nhảy nhót liên tục là thứ gây khó
 *      chịu nhất cho người mẫn cảm chuyển động; ở chế độ đó mũi tên đứng yên
 *      nhưng VẪN chỉ đúng chỗ.
 *   3. **Hai đường tắt, khác nhau rõ ràng.** ✕ tắt cho lượt này (không ghi gì);
 *      "Không nhắc lại" mới ghi xuống `localStorage`. Người dùng chọn mức cam
 *      kết, không bị một cú bấm vô tình khoá luôn hướng dẫn.
 */

/**
 * `localStorage` ở đây là ĐÚNG chỗ, không phạm luật `Q6`.
 *
 * `Q6` cấm `localStorage` cho **thứ tự xáo trộn** vì đó là trạng thái học và
 * phải mất khi đăng xuất. Còn đây là một mẩu tuỳ chọn giao diện của riêng cái
 * máy đang dùng: không phải dữ liệu cá nhân, không ảnh hưởng bài học, và lưu ở
 * DB thì đổi lấy một migration + RLS cho một việc không đáng.
 */
const STORAGE_KEY = "polymind.flashcard-start-hint.dismissed";

/**
 * Đọc `localStorage` bằng `useSyncExternalStore`, KHÔNG bằng `useEffect` +
 * `setState`.
 *
 * Đây là đúng công cụ cho việc "đọc một hệ thống ngoài React và có SSR":
 * `getServerSnapshot` trả `true` (coi như đã tắt) nên HTML từ máy chủ không mang
 * hướng dẫn, và React tự dựng lại sau hydrate — không nháy, không lệch hydrate,
 * và không phạm luật `react-hooks/set-state-in-effect`.
 */
function subscribe(onChange: () => void) {
  // Đổi ở tab khác cũng phải có hiệu lực ở tab này.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư của một số WebView) thì cứ hiện
    // hướng dẫn — hỏng vế "nhớ đã tắt" còn đỡ hơn hỏng vế chỉ đường.
    return false;
  }
}

export function FlashcardStartHint() {
  const dismissedForever = useSyncExternalStore(
    subscribe,
    readDismissed,
    () => true,
  );
  /** ✕ — chỉ tắt cho lượt xem này, không ghi gì. */
  const [dismissedNow, setDismissedNow] = useState(false);

  if (dismissedForever || dismissedNow) return null;

  return (
    <div
      // `status` chứ không `alert`: đây là mách nước, không phải lỗi. Trình đọc
      // màn hình đọc khi rảnh, không cắt ngang việc đang làm.
      role="status"
      className="border-student-sky-border bg-student-sky-surface text-student-sky-ink flex items-start gap-2 rounded-xl border p-3"
    >
      <ArrowDown
        aria-hidden
        className="mt-0.5 size-5 shrink-0 animate-bounce motion-reduce:animate-none"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Bấm “Bắt đầu ôn thẻ” ở dưới để học flashcard toàn màn hình.
        </p>
        <p className="mt-0.5 text-sm">
          Muốn luyện lại câu từng làm sai thì chọn tab “Ôn Tập Câu Sai” ở trên.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              // Không lưu được thì vẫn phải tắt cho lượt này.
            }
            setDismissedNow(true);
          }}
        >
          Không nhắc lại
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label="Tắt hướng dẫn"
        title="Tắt hướng dẫn"
        onClick={() => setDismissedNow(true)}
      >
        <X className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
