"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Bảng dữ liệu của khu Quản trị.
 *
 * Gom đúng **một** cách dựng bảng cho cả 12 màn Admin, thay vì để mỗi màn tự
 * chép lại — bài học `UX-UIUX-M25-010` (ô số liệu bị chép ba bản rồi trôi khác
 * nhau ở chỗ nhìn thấy được).
 *
 * Bốn thứ được ép ở đây vì cả bốn đều đã từng bị quên ở màn khác:
 *
 * 1. **`caption` bắt buộc trong KIỂU DỮ LIỆU.** Cùng cách `native-select.tsx`
 *    bắt buộc `id`: quên là lỗi biên dịch, không phải lỗi im lặng phát hiện sau
 *    ba tháng bằng axe.
 * 2. **Vùng cuộn tới được bằng bàn phím** — nhưng **chỉ khi nó thật sự cuộn**
 *    (`DS-038` luật 3). Người dùng bàn phím không cuộn ngang được vùng
 *    `overflow-x:auto` nếu bên trong không có gì Tab tới; ngược lại, gắn
 *    `tabIndex` cố định cho vùng **không** cuộn thì chỉ tạo thêm một chặng Tab
 *    vô nghĩa. Đo bằng `ResizeObserver` nên đúng ở mọi bề rộng.
 * 3. **Cột định danh dính khi cuộn ngang.** Đã **đo trong trình duyệt trước khi
 *    xây**: bọc `overflow-x:auto` thì CSS tính luôn `overflow-y:auto`, khiến
 *    `clientHeight === scrollHeight` — `<thead position:sticky; top:0>` **không
 *    còn chỗ để dính** (cuộn trang 600px thì thead trôi lên `top:-199px`). Cột
 *    đầu `sticky; left:0` thì dính đúng (đo được `left:1px` so với mép vùng
 *    `0px` sau khi cuộn ngang 400px). Nên chỗ này ghim **cột định danh**, không
 *    ghim hàng tiêu đề.
 * 4. **`min-width` thật.** Không có nó thì 7 cột bị bóp còn ~51px mỗi cột và
 *    tiêu đề vỡ 3 dòng (đúng lỗi đã đo ở `M19`), tức "vừa màn hình" trên giấy
 *    nhưng không đọc được trên máy.
 */
export function DataTable({
  caption,
  minWidthClass = "min-w-[52rem]",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"table">, "children"> & {
  /** Bắt buộc: trình đọc màn hình dùng câu này để biết bảng đang liệt kê cái gì. */
  caption: string;
  /** Bề rộng tối thiểu để các cột không bị bóp thành sợi. */
  minWidthClass?: string;
  children: React.ReactNode;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = React.useState(false);
  const captionId = React.useId();

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={scrollRef}
      data-slot="data-table-scroller"
      // `tabIndex`/`role` chỉ xuất hiện khi bảng thật sự tràn — xem ghi chú (2).
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? "region" : undefined}
      aria-labelledby={scrollable ? captionId : undefined}
      className={cn(
        "focus-visible:ring-ring relative w-full overflow-x-auto focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      <table
        data-slot="data-table"
        className={cn("w-full text-sm", minWidthClass, className)}
        {...props}
      >
        <caption id={captionId} className="sr-only">
          {caption}
          {scrollable ? " (cuộn ngang để xem hết cột)" : ""}
        </caption>
        {children}
      </table>
    </div>
  );
}

/** Hàng tiêu đề. Tách ra để mọi bảng Admin có cùng một kiểu nền/viền. */
export function DataTableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="data-table-header"
      className={cn(
        // `bg-muted` ĐẶC, không phải `bg-muted/40`: ô tiêu đề đầu tiên là
        // `sticky`, nền trong suốt thì chữ của cột sau trôi qua bên dưới nó —
        // chụp ảnh lúc cuộn ngang thì hàng tiêu đề đọc ra **"Mãên hệ"**.
        "bg-muted text-text-secondary border-y text-left",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="data-table-body"
      className={cn("divide-y", className)}
      {...props}
    />
  );
}

export function DataTableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="data-table-row"
      // `group` chứ không tô nền ngay ở `<tr>`: ô định danh dính phải có nền
      // ĐẶC (nếu không thì chữ cột sau trôi qua dưới nó khi cuộn), mà nền đặc
      // đó lại che mất màu hover của cả hàng — nhìn ảnh chụp thì thấy rõ ô đầu
      // vẫn trắng trong khi phần còn lại của hàng đã đổi màu. Nên màu hover
      // được tô ở TỪNG Ô qua `group-hover`, để ô dính đổi màu cùng nhịp.
      className={cn("group transition-colors", className)}
      {...props}
    />
  );
}

/**
 * Ô tiêu đề cột. `scope="col"` đặt sẵn — thiếu nó thì trình đọc màn hình không
 * ghép được ô dữ liệu với tên cột, và đó là thứ không ai nhìn thấy bằng mắt nên
 * không bao giờ được báo cáo.
 */
export function DataTableHead({
  className,
  numeric,
  sticky,
  scope = "col",
  ...props
}: React.ComponentProps<"th"> & {
  /** Cột số: canh phải để so sánh hàng nào lớn hơn bằng mắt. */
  numeric?: boolean;
  /** Cột định danh dính khi cuộn ngang. Chỉ dùng cho cột ĐẦU TIÊN. */
  sticky?: boolean;
}) {
  return (
    <th
      data-slot="data-table-head"
      scope={scope}
      className={cn(
        "px-3 py-2.5 font-medium whitespace-nowrap",
        numeric && "text-right",
        // `border-r`: ranh giới nhìn thấy được để cột định danh đọc ra là
        // "đang được ghim", chứ không phải chữ của cột sau bị dính vào.
        sticky && "bg-muted sticky left-0 z-10 border-r",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({
  className,
  numeric,
  sticky,
  ...props
}: React.ComponentProps<"td"> & {
  numeric?: boolean;
  sticky?: boolean;
}) {
  return (
    <td
      data-slot="data-table-cell"
      className={cn(
        "bg-card group-hover:bg-row-hover px-3 py-2.5 align-middle transition-colors",
        // `tabular-nums` để các chữ số thẳng cột — không có nó thì mắt không so
        // sánh được hai số cùng cột (bài học `UX-UIUX-M25-010`).
        numeric && "text-right tabular-nums",
        // Nền đặc bắt buộc: nền trong suốt thì chữ cột sau trôi qua dưới cột dính.
        sticky && "sticky left-0 z-10 border-r",
        className,
      )}
      {...props}
    />
  );
}
