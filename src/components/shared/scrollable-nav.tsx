"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Vùng cuộn ngang cho dải tab.
 *
 * ⚠️ **Từ `UX-MOBILE-1` (2026-08-05) KHÔNG dải tab nào còn dùng component này.**
 * User bác bỏ hẳn lối cuộn ngang trên điện thoại: *"tôi không thích giao diện
 * điện thoại mà phải cuộn ngang và việc cuộn ngang này có thể khiến người ta
 * không biết là phải cuộn ngang hả"*. Dải tab nay đi qua
 * `components/shared/responsive-tabs.tsx` — nút chọn mục + bảng trượt dưới
 * `sm`, dải ngang `flex-wrap` từ `sm` trở lên. **Đừng dựng dải tab mới bằng
 * file này.** Giữ lại vì luật `tabIndex` có điều kiện ở dưới vẫn đúng cho
 * những vùng THẬT SỰ phải cuộn ngang (bảng dữ liệu nhiều cột).
 *
 * Cùng một luật với `DataTable`: **chỉ nhận tiêu điểm khi thật sự cuộn được**
 * (`DS-038` luật 3).
 *
 * Vì sao dải tab cần vùng cuộn riêng: Radix Tabs dùng **roving tabindex** — chỉ
 * đúng một tab đang chọn nằm trong luồng Tab, các tab còn lại đi bằng phím mũi
 * tên. Nên lập luận "bên trong đã có nút bấm rồi" **không** cứu được vùng cuộn:
 * người dùng bàn phím không có cách nào cuộn ngang tới các tab bị khuất. Đây là
 * lỗi `UX-UIUX-M21-009`, đã sửa ở khu học viên rồi lặp lại ở khu giáo viên
 * (`P17-T5`) và khu quản trị (`P18-T5`).
 *
 * Ngược lại, gắn `tabIndex` cố định cho dải **không** cuộn (ví dụ 2 tab ngắn ở
 * `/admin/notifications`) chỉ tạo thêm một chặng Tab không làm gì cả.
 */
export function ScrollableNav({
  label,
  className,
  children,
}: {
  /** Tên gọi được của vùng — trình đọc màn hình đọc câu này khi Tab tới. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [scrollable, setScrollable] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={ref}
      aria-label={label}
      tabIndex={scrollable ? 0 : undefined}
      className={cn(
        "focus-visible:ring-ring overflow-x-auto rounded-lg focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </nav>
  );
}
