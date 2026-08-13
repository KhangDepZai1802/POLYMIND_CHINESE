"use client";

import { Check } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { RatingOption } from "../domain/labels";

/**
 * Thang 1–5.
 *
 * 🔴 SỐ LUÔN HIỆN, kể cả ở ô chưa chọn. Màu chỉ là lớp thứ hai — nền đỏ→xanh
 * theo mức, nhưng đọc con số là đủ biết đang ở đâu trên thang.
 *
 * Nút cao 44px theo WCAG: giáo viên bấm cái này ngay sau buổi dạy, trên điện
 * thoại, đôi khi vừa dọn lớp vừa bấm.
 *
 * Mô tả đầy đủ của mức ĐANG CHỌN hiện ngay bên dưới thay vì in cả 5 dòng như
 * bản mẫu Word — không mất chữ nào, chỉ bớt 4 dòng thừa.
 */
export function RatingScale({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  options: readonly RatingOption[];
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const chosen = options.find((option) => option.value === value) ?? null;

  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex gap-1.5" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${option.value} — ${option.label}${option.description ? `: ${option.description}` : ""}`}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "focus-visible:ring-ring grid min-h-11 flex-1 place-items-center rounded-lg border font-mono text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
                active
                  ? ["border-transparent text-white", SCALE_TONE[option.value] ?? "bg-primary"]
                  : "border-input text-text-secondary hover:bg-muted bg-background",
              )}
            >
              {option.value}
            </button>
          );
        })}
      </div>
      {chosen ? (
        <p className="text-sm font-semibold">
          {chosen.value} — {chosen.label}
          {chosen.description && (
            <span className="text-text-secondary font-normal">
              {" "}
              · {chosen.description}
            </span>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">Chưa chọn</p>
      )}
    </fieldset>
  );
}

/** Nền của mức đang chọn — thang liên tục đỏ → xanh, đi cùng con số. */
const SCALE_TONE: Record<number, string> = {
  1: "bg-[#b91c1c]",
  2: "bg-[#c2620e]",
  3: "bg-[#92400e]",
  4: "bg-[#2f7d4f]",
  5: "bg-[#166534]",
};

/** Dải nút chọn một trong nhiều — dùng cho hình thức, mức hoàn thành kế hoạch. */
export function SegmentedChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  required,
  className,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="text-sm font-semibold">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </legend>
      <div className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "focus-visible:ring-ring min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-text-secondary hover:bg-muted bg-background",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Cặp Không / Có.
 *
 * `value` nhận `null` để phân biệt "chưa trả lời" với "đã trả lời Không" —
 * `D-43` điểm 5 dựa vào chính sự phân biệt đó ở mục 6.
 */
export function YesNoChoice({
  label,
  value,
  onChange,
  disabled,
  noLabel = "Không",
  yesLabel = "Có",
  hint,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  noLabel?: string;
  yesLabel?: string;
  hint?: string;
}) {
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex gap-1.5" role="radiogroup">
        {[
          { key: false, text: noLabel },
          { key: true, text: yesLabel },
        ].map((option) => {
          const active = value === option.key;
          return (
            <button
              key={String(option.key)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.key)}
              className={cn(
                "focus-visible:ring-ring min-h-11 min-w-24 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-text-secondary hover:bg-muted bg-background",
              )}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </fieldset>
  );
}

/** Danh sách chọn một — dùng cho mục 9 (5 mức, mỗi mức một câu dài). */
export function RadioList<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-1" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="grid gap-0.5" role="radiogroup">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className="focus-visible:ring-ring hover:bg-muted flex min-h-11 items-start gap-2.5 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                  active ? "border-primary bg-primary" : "border-input",
                )}
              >
                {active && <span className="size-1.5 rounded-full bg-white" />}
              </span>
              <span className="text-sm">
                <span className={cn(active && "font-semibold")}>{option.label}</span>
                {option.description && (
                  <span className="text-text-secondary"> — {option.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Ô đánh dấu nhiều lựa chọn. */
export function CheckboxGrid<T extends string>({
  label,
  options,
  values,
  onToggle,
  disabled,
  columns = 2,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  values: readonly T[];
  onToggle: (value: T) => void;
  disabled?: boolean;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div
        className={cn(
          "grid gap-x-4 gap-y-0.5",
          columns === 2 && "sm:grid-cols-2",
        )}
      >
        {options.map((option) => (
          <CheckboxRow
            key={option.value}
            label={option.label}
            checked={values.includes(option.value)}
            onChange={() => onToggle(option.value)}
            disabled={disabled}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  disabled,
  emphasis,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="focus-visible:ring-ring hover:bg-muted flex min-h-11 w-full items-start gap-2.5 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border-[1.5px]",
          checked ? "border-primary bg-primary" : "border-input",
        )}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={4} />}
      </span>
      <span className={cn("text-sm", emphasis && "font-semibold")}>{label}</span>
    </button>
  );
}

/** Nhãn + ô nhập, dùng chung để mọi trường trong biểu mẫu có cùng khoảng cách. */
export function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
