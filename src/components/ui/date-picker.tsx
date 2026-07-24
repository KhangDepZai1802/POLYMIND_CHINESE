"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Ô chọn ngày dùng chung — thay cho `<input type="date">` mặc định của trình
 * duyệt (mỗi trình duyệt một kiểu, xấu và khó chọn năm).
 *
 * • Hiển thị ngày kiểu Việt Nam: 15/03/2005.
 * • Có dropdown chọn tháng/năm — bấm phát nhảy tới năm sinh, không phải click
 *   mũi tên hàng trăm lần.
 * • Vẫn submit chuỗi `yyyy-MM-dd` qua một `<input type="hidden" name=...>` nên
 *   server action / zod schema không phải đổi gì.
 */
export function DatePicker({
  name,
  defaultValue,
  placeholder = "Chọn ngày",
  id,
  disabled,
  fromYear = 1920,
  toYear = new Date().getFullYear() + 5,
  disableFuture = false,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  name: string;
  /** Giá trị ban đầu dạng `yyyy-MM-dd`. */
  defaultValue?: string | null;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
  /** Chặn chọn ngày trong tương lai (ví dụ: ngày sinh). */
  disableFuture?: boolean;
  className?: string;
  /**
   * Hai prop dưới đây là **tùy chọn và thuần cộng thêm** (`P17-T3`): nút mở lịch
   * là phần tử người dùng focus vào, nên lỗi ngày phải gắn vào chính nó thì
   * trình đọc màn hình mới đọc ra. Không truyền thì render y như trước.
   */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(() =>
    defaultValue ? parse(defaultValue, "yyyy-MM-dd", new Date()) : undefined,
  );

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={date ? format(date, "yyyy-MM-dd") : ""}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0" aria-hidden />
            {date ? (
              format(date, "dd/MM/yyyy")
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={vi}
            captionLayout="dropdown"
            startMonth={new Date(fromYear, 0)}
            endMonth={new Date(toYear, 11)}
            defaultMonth={date ?? new Date(Math.min(toYear, today.getFullYear()), today.getMonth())}
            selected={date}
            onSelect={(d) => {
              setDate(d);
              if (d) setOpen(false);
            }}
            disabled={disableFuture ? { after: today } : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
