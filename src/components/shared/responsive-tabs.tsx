"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ResponsiveTabItem = {
  value: string;
  label: string;
  /** Icon đã dựng sẵn (ReactNode chứ không phải component) để trang server truyền qua được. */
  icon?: React.ReactNode;
  /** Phần phụ bên phải nhãn — thường là con số. */
  badge?: React.ReactNode;
  /** Có `href` thì dải tab lái bằng URL: mục là liên kết, không đổi state. */
  href?: string;
};

/**
 * Dải tab của một module, đổi hình theo bề rộng màn.
 *
 * ## Vì sao không còn cuộn ngang (`UX-MOBILE-1`, user chốt 2026-08-05)
 *
 * Bản cũ là `overflow-x-auto` + `min-w-max`: ở 375px dải 7 tab của
 * `/student/class` cần ~754px, tức **hơn hai màn hình** — và vùng cuộn ngang
 * **không có dấu hiệu nào** cho biết còn nội dung bên phải. User báo đúng chỗ
 * đau: *"việc cuộn ngang này có thể khiến người ta không biết là phải cuộn
 * ngang hả"*. Bốn tab cuối coi như không tồn tại.
 *
 * Dưới `sm` nay là **nút chọn mục + bảng trượt từ dưới lên** (user chọn phương
 * án B thay vì lưới 2 cột): nút cao 44px, hiện đúng mục đang xem kèm **`n/N`**
 * — chính con số đó thay cho affordance đã mất, người dùng biết ngay module có
 * bao nhiêu mục mà không phải vuốt thử. Từ `sm` trở lên là dải tab ngang như cũ,
 * chỉ thay `min-w-max` bằng `flex-wrap` để không bao giờ tràn nữa.
 *
 * ⛔ **Không dựng hai `TabsList` (một cho mobile, một cho desktop).** Radix sinh
 * id trigger theo `(baseId, value)` nên hai list sẽ cho ra **id trùng** trong
 * DOM. Vì vậy list chỉ có MỘT bản, `display:none` dưới `sm`; `aria-labelledby`
 * của panel vẫn trỏ tới nó và vẫn tính được tên gọi — theo accname, node bị ẩn
 * mà được `aria-labelledby` trỏ tới thì vẫn được đọc.
 */
export function ResponsiveTabs({
  label,
  items,
  value: controlledValue,
  onValueChange,
  defaultValue,
  activationMode,
  className,
  navProps,
  listWrapperClassName,
  listClassName,
  triggerClassName,
  pickerClassName,
  children,
}: {
  /** Tên gọi của dải tab — đọc cho trình đọc màn hình và làm tiêu đề bảng trượt. */
  label: string;
  items: ResponsiveTabItem[];
  /**
   * Truyền `value` để tự giữ trạng thái ở ngoài. Kèm `onValueChange` thì đổi
   * bằng state; không kèm thì dải tab lái bằng URL (mục phải có `href`).
   */
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  activationMode?: "automatic" | "manual";
  className?: string;
  /**
   * Gắn thẳng lên khối bọc CẢ nút chọn lẫn dải tab. Dùng cho những thuộc tính
   * mà CSS bên ngoài đang bắt — ví dụ `data-review-chrome` ở `/student/review`,
   * cái mà `globals.css` dùng để ẩn chrome khi ôn thẻ toàn màn hình.
   */
  navProps?: React.ComponentPropsWithoutRef<"div"> & {
    [key: `data-${string}`]: string;
  };
  listWrapperClassName?: string;
  listClassName?: string;
  triggerClassName?: string;
  pickerClassName?: string;
  children: React.ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    () => defaultValue ?? items[0]?.value ?? "",
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  // Không có cách đổi bằng state ⇒ dải tab lái bằng URL, để `Link` tự làm việc.
  const handleChange = isControlled ? onValueChange : setUncontrolledValue;

  return (
    <Tabs
      value={value}
      onValueChange={handleChange}
      activationMode={activationMode}
      className={className}
    >
      <div {...navProps}>
        <TabPicker
          className={cn("sm:hidden", pickerClassName)}
          label={label}
          items={items}
          value={value}
          onSelect={handleChange}
        />

        <div className={cn("hidden sm:block", listWrapperClassName)}>
          <TabsList className={cn("flex-wrap", listClassName)}>
            {items.map((item) =>
              item.href ? (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={triggerClassName}
                  asChild
                >
                  <Link href={item.href} scroll={false}>
                    {item.icon}
                    {item.label}
                    {item.badge}
                  </Link>
                </TabsTrigger>
              ) : (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={triggerClassName}
                >
                  {item.icon}
                  {item.label}
                  {item.badge}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </div>
      </div>

      {children}
    </Tabs>
  );
}

/**
 * Nút chọn mục cho màn hẹp. Tách riêng để dùng lại được ở những dải điều hướng
 * KHÔNG phải Radix Tabs (ví dụ mục lục 35 buổi flashcard).
 */
export function TabPicker({
  label,
  items,
  value,
  onSelect,
  className,
}: {
  label: string;
  items: ResponsiveTabItem[];
  value: string;
  onSelect?: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const activeIndex = items.findIndex((item) => item.value === value);
  const active = items[activeIndex] ?? items[0];

  if (!active) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          // Mỏ neo cho e2e: trang nào cũng có sẵn `Sheet` khác (menu điện thoại
          // ở header), nên bài kiểm cần trỏ đúng nút này chứ không phải "cái
          // sheet-trigger đầu tiên".
          data-slot="tab-picker"
          className={cn(
            "border-input bg-background text-foreground focus-visible:ring-ring flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-4 py-2 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
            className,
          )}
        >
          {active.icon}
          <span className="truncate">{active.label}</span>
          {active.badge}
          {/* `n/N` thay cho affordance mà vùng cuộn ngang không có: đọc một cái
              là biết module còn bao nhiêu mục nữa. */}
          <span className="text-text-secondary ml-auto shrink-0 text-xs font-medium tabular-nums">
            {activeIndex < 0 ? 1 : activeIndex + 1}/{items.length}
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[80dvh] gap-0 rounded-t-2xl p-0"
      >
        <span
          className="bg-border mx-auto mt-3 h-1 w-9 shrink-0 rounded-full"
          aria-hidden
        />
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">{label}</SheetTitle>
          <SheetDescription className="sr-only">
            Chọn mục muốn xem. Đang xem: {active.label}.
          </SheetDescription>
        </SheetHeader>

        {/* `pb-[env(safe-area-inset-bottom)]`: mục cuối không nằm dưới thanh
            cử chỉ của điện thoại. */}
        <ul className="overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const isActive = item.value === value;
            const rowClass = cn(
              "flex min-h-12 w-full items-center gap-3 border-t px-5 py-3 text-left text-sm",
              isActive
                ? "bg-accent text-foreground font-semibold"
                : "text-text-secondary",
            );
            const inner = (
              <>
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge}
                {/* Dấu tích chứ không chỉ đổi nền: trạng thái không được dựa
                    vào riêng màu. */}
                {isActive && (
                  <Check className="text-primary size-4 shrink-0" aria-hidden />
                )}
              </>
            );

            return (
              <li key={item.value}>
                {item.href ? (
                  <Link
                    href={item.href}
                    scroll={false}
                    aria-current={isActive ? "true" : undefined}
                    className={rowClass}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    className={rowClass}
                    onClick={() => {
                      onSelect?.(item.value);
                      setOpen(false);
                    }}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
