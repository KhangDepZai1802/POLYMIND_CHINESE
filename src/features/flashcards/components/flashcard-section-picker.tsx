"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Mục lục buổi của trình đọc flashcard (`UX-MOBILE-1`, 2026-08-05).
 *
 * ## Vì sao bỏ dải nút xếp ngang
 *
 * Bản cũ là 35 nút trong một khung `overflow-x-auto`: muốn tới buổi 27 phải kéo
 * qua 26 nút, và trên điện thoại cú vuốt ngang ấy nằm ngay cạnh vùng vuốt lật
 * thẻ. Đây đúng là vấn đề mà **khu Quản trị đã bỏ từ `MULTIDECK-1e`** — bên đó
 * đổi sang cột dọc có ô lọc. Khu học viên là chỗ cuối cùng còn giữ lối cũ.
 *
 * Nay: một nút hiện *buổi đang xem* + `n/N`, chạm vào mở **lưới số** — 35 buổi
 * nằm gọn trong 7 hàng × 5 cột, **thấy hết trong một màn, một chạm tới bất kỳ
 * buổi nào**, không còn chiều nào phải cuộn.
 *
 * ⚠️ Nút mở giữ đúng `h-9` (36px) như dải cũ, theo yêu cầu user 2026-07-25
 * (*"chỗ mục lục buổi có thể cho nút nó lùn lại hơn xíu để flashcard có thêm
 * khoảng trống"*). Trên cảm ứng `globals.css` vẫn ép `min-height: 44px` nên
 * ngón tay không bị thiệt. Các ô TRONG lưới thì đủ 44px vì chúng chỉ tồn tại
 * lúc bảng đang mở, không tranh chỗ với thẻ.
 */
export function FlashcardSectionPicker({
  sections,
  currentSectionId,
  onSelect,
}: {
  sections: Array<{ id: string; session_number: number }>;
  currentSectionId: string;
  onSelect: (sectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentIndex = sections.findIndex(
    (section) => section.id === currentSectionId,
  );
  const current = sections[currentIndex] ?? sections[0];

  if (!current) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="mt-1.5 h-9 w-full justify-start gap-2"
        >
          <span className="font-semibold">Buổi {current.session_number}</span>
          <span className="text-text-secondary ml-auto text-xs font-medium tabular-nums">
            {currentIndex < 0 ? 1 : currentIndex + 1}/{sections.length}
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </Button>
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
          <SheetTitle className="text-base">Chọn buổi</SheetTitle>
          <SheetDescription className="text-xs">
            {sections.length} buổi đã mở · đang xem buổi{" "}
            {current.session_number}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-5 gap-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sections.map((section) => {
            const isCurrent = section.id === current.id;
            return (
              <Button
                key={section.id}
                type="button"
                variant={isCurrent ? "default" : "outline"}
                aria-current={isCurrent ? "true" : undefined}
                className="min-h-11 tabular-nums"
                onClick={() => {
                  onSelect(section.id);
                  setOpen(false);
                }}
              >
                <span className="sr-only">Buổi </span>
                {section.session_number}
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Dải nút ngang cho màn rộng — giữ nguyên hình dáng cũ, chỉ thôi cuộn ngang. */
export function FlashcardSectionRail({
  sections,
  currentSectionId,
  onSelect,
  className,
}: {
  sections: Array<{ id: string; session_number: number }>;
  currentSectionId: string;
  onSelect: (sectionId: string) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Mục lục buổi flashcard"
      className={cn("mt-1.5 flex flex-wrap gap-2", className)}
    >
      {sections.map((section) => (
        <Button
          key={section.id}
          type="button"
          size="sm"
          variant={section.id === currentSectionId ? "default" : "outline"}
          className="h-9 shrink-0"
          onClick={() => onSelect(section.id)}
        >
          Buổi {section.session_number}
        </Button>
      ))}
    </nav>
  );
}
