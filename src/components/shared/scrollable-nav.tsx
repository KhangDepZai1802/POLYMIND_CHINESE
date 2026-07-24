"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Vùng cuộn ngang cho dải tab.
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
