"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Ô chọn ngày + giờ dùng chung — thay cho `<input type="datetime-local">`.
 *
 * • Lịch đồng bộ style với web (như [DatePicker]), thêm ô chọn giờ bên dưới.
 * • Vẫn submit đúng chuỗi `yyyy-MM-dd'T'HH:mm` (GIỜ VIỆT NAM, wall-clock) qua
 *   hidden input, y hệt datetime-local cũ — nên `fromLocalInput` / zod schema
 *   phía server không phải đổi gì.
 */
export function DateTimePicker({
  name,
  defaultValue,
  placeholder = "Chọn ngày giờ",
  defaultTime = "08:00",
  id,
  disabled,
  fromYear = 1920,
  toYear = new Date().getFullYear() + 5,
  className,
}: {
  name: string;
  /** Giá trị ban đầu dạng `yyyy-MM-dd'T'HH:mm`. */
  defaultValue?: string | null;
  placeholder?: string;
  /** Giờ mặc định điền sẵn khi người dùng vừa chọn ngày mà chưa đặt giờ. */
  defaultTime?: string;
  id?: string;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const initial = React.useMemo(() => {
    if (!defaultValue) return { date: undefined as Date | undefined, time: "" };
    const [datePart, timePart] = defaultValue.split("T");
    return {
      date: datePart ? parse(datePart, "yyyy-MM-dd", new Date()) : undefined,
      time: timePart ? timePart.slice(0, 5) : "",
    };
  }, [defaultValue]);

  const [date, setDate] = React.useState<Date | undefined>(initial.date);
  const [time, setTime] = React.useState(initial.time);

  const value = date ? `${format(date, "yyyy-MM-dd")}T${time || defaultTime}` : "";
  const timeId = id ? `${id}-time` : undefined;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0" aria-hidden />
            {date ? (
              `${format(date, "dd/MM/yyyy")} ${time || defaultTime}`
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
            defaultMonth={date ?? new Date()}
            selected={date}
            onSelect={(d) => {
              setDate(d);
              if (d && !time) setTime(defaultTime);
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 border-t p-3">
            <Label htmlFor={timeId} className="text-sm font-normal">
              Giờ
            </Label>
            <Input
              id={timeId}
              type="time"
              value={time || defaultTime}
              onChange={(e) => setTime(e.target.value)}
              className="w-auto"
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
