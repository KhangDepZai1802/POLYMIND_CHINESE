"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Bảng dấu Pinyin theo docs/09 §27. Không tự chuyển Pinyin→Hán, chỉ chèn dấu.
const TONE_CHARS = [
  "ā", "á", "ǎ", "à",
  "ē", "é", "ě", "è",
  "ī", "í", "ǐ", "ì",
  "ō", "ó", "ǒ", "ò",
  "ū", "ú", "ǔ", "ù",
  "ǖ", "ǘ", "ǚ", "ǜ",
  "ü",
];

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  current: string,
  onChange: (value: string) => void,
) {
  if (!el) {
    onChange(current + text);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

/**
 * Ô nhập có thanh chèn dấu Pinyin. Giữ IME tiếng Trung (không validate khi
 * đang composing); nút "拼" hiện/ẩn bảng dấu.
 */
export function PinyinField({
  value,
  onChange,
  multiline = false,
  className,
  rows,
  placeholder,
  id,
  required,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
  rows?: number;
  placeholder?: string;
  id?: string;
  required?: boolean;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [showTones, setShowTones] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        {multiline ? (
          <Textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={id}
            rows={rows}
            required={required}
            placeholder={placeholder}
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn("flex-1", className)}
          />
        ) : (
          <Input
            ref={ref as React.Ref<HTMLInputElement>}
            id={id}
            required={required}
            placeholder={placeholder}
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn("flex-1", className)}
          />
        )}
        <Button
          type="button"
          size="sm"
          variant={showTones ? "secondary" : "outline"}
          aria-pressed={showTones}
          aria-label="Chèn dấu Pinyin"
          onClick={() => setShowTones((open) => !open)}
        >
          拼
        </Button>
      </div>
      {showTones && (
        <div className="flex flex-wrap gap-1 rounded-md border p-2">
          {TONE_CHARS.map((char) => (
            <button
              key={char}
              type="button"
              className="hover:bg-muted h-8 w-8 rounded border text-base"
              // Ngăn field mất focus khi bấm để giữ vị trí con trỏ.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertAtCursor(ref.current, char, value, onChange)}
            >
              {char}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
