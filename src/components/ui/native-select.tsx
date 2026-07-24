import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `<select>` gốc của trình duyệt, mang đúng hình dáng của `Input`.
 *
 * Vì sao không dùng `ui/select.tsx` (Radix) ở mọi chỗ: bộ lọc Ngân hàng câu hỏi
 * là `<form>` GET **không có JavaScript của riêng nó** — select gốc luôn gửi
 * đúng giá trị kể cả khi hydrate chưa xong. Radix để dành cho chỗ cần
 * `onValueChange` thật (ví dụ ô chọn bộ bài tập phải cập nhật điểm tối đa).
 *
 * Gom lại vì đúng chuỗi class này từng bị chép ở **6 chỗ** trong M16 + M17
 * (`P17-T1`), và cả 6 đều dùng `border` (`#DDE5EE`, **1.27:1** trên nền trắng)
 * thay vì `border-input` (`#7C8DA4`, **3.39:1**) — tức viền ô chọn gần như vô
 * hình, đúng lỗi `UX-M00-002`. Cũng chép cứng `h-9` trong khi thang control của
 * `DS-013` cho ô nhập là `h-10`, nên ô chọn và ô nhập đứng cạnh nhau lệch nhau
 * 4px.
 *
 * ⚠️ `id` là **bắt buộc**: sáu chỗ cũ đều có `<Label>` không gắn `htmlFor` nên
 * trình đọc màn hình đọc ra "combo box" không tên. Bắt buộc `id` ở kiểu dữ liệu
 * để lỗi đó không quay lại một cách im lặng.
 */
export function NativeSelect({
  className,
  id,
  ...props
}: Omit<React.ComponentProps<"select">, "id"> & { id: string }) {
  return (
    <select
      id={id}
      data-slot="native-select"
      className={cn(
        "border-input bg-background h-10 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}
