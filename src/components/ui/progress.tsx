"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Thanh tiến độ có ngữ nghĩa.
 *
 * Cố ý **không** dùng Radix Progress cho một hình dạng chỉ có một `div` bên
 * trong — nhưng ba thứ dưới đây thì bắt buộc, vì thiếu chúng thanh này chỉ là
 * vệt màu và người dùng trình đọc màn hình không biết gì đang xảy ra:
 *
 * 1. `role="progressbar"` + `aria-valuenow/min/max` — trạng thái đọc được.
 * 2. `aria-label` **bắt buộc trong kiểu dữ liệu**, giống cách `DataTable` bắt
 *    buộc `caption`: quên là lỗi biên dịch chứ không phải lỗi im lặng.
 * 3. Chỉ animate `transform`, không animate `width` — animate `width` gây
 *    reflow mỗi khung hình (`layout-shift-avoid`). Và toàn bộ chuyển động tắt
 *    khi người dùng bật `prefers-reduced-motion`.
 *
 * ⚠️ Thanh này KHÔNG thay được chữ "14/38". Người dùng cần con số thật; màu chỉ
 * là phụ trợ (`color-not-only`). Nơi gọi phải in số bên cạnh.
 */
export function Progress({
  value,
  max = 100,
  className,
  label,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
  max?: number;
  /** Bắt buộc: trình đọc màn hình cần biết thanh này đo cái gì. */
  label: string;
}) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const ratio = clamped / safeMax;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={cn(
        "bg-muted relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <div
        className="bg-primary size-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
