"use client";

import { Check, ChevronDown } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { SectionState, SectionStatus } from "../domain/completion";

/**
 * Dấu tình trạng của một mục.
 *
 * 🔴 BA HÌNH KHÁC NHAU, không phải ba màu khác nhau: dấu tích · chấm giữa vòng ·
 * vòng nét đứt. In đen trắng hay nhìn bằng mắt loạn màu vẫn đọc được — màu chỉ
 * là lớp thông tin thứ hai. Đây là luật "không dùng màu làm tín hiệu duy nhất"
 * mà repo áp cho mọi trạng thái.
 */
export function SectionStateIcon({
  state,
  className,
}: {
  state: SectionState;
  className?: string;
}) {
  const label =
    state === "done" ? "Đã xong" : state === "partial" ? "Đang dở" : "Chưa điền";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
        state === "done" && "border-success bg-success",
        state === "partial" && "border-warning bg-warning/15",
        state === "empty" && "border-border-strong border-dashed bg-transparent",
        className,
      )}
    >
      {state === "done" && (
        <Check className="size-2.5 text-white" strokeWidth={4} aria-hidden />
      )}
      {state === "partial" && (
        <span className="bg-warning size-1.5 rounded-full" aria-hidden />
      )}
    </span>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2 text-xs">
      <span className="flex items-center gap-1">
        <SectionStateIcon state="done" className="size-3" /> xong
      </span>
      <span className="flex items-center gap-1">
        <SectionStateIcon state="partial" className="size-3" /> đang dở
      </span>
      <span className="flex items-center gap-1">
        <SectionStateIcon state="empty" className="size-3" /> chưa điền
      </span>
    </div>
  );
}

/** Cột mục lục dính cho màn rộng. */
export function ReportSectionRail({
  sections,
  doneCount,
  activeSection,
  onSelect,
}: {
  sections: SectionStatus[];
  doneCount: number;
  activeSection: number;
  onSelect: (sectionNumber: number) => void;
}) {
  return (
    /*
     * 🔴 `top-20` (5rem) chứ KHÔNG phải `top-4`. Header của dashboard là
     * `sticky top-0 z-30 h-16` — dính ở 1rem thì cột mục lục trượt xuống DƯỚI
     * header và mục 1 bị che mất hẳn (user báo kèm ảnh 2026-08-13). 5rem = 4rem
     * header + 1rem thở, đúng con số mà `scroll-mt-20` của `SectionCard` đã
     * dùng để canh chỗ nhảy tới — hai chỗ phải cùng một mốc, lệch nhau thì bấm
     * vào mục N sẽ dừng ở chỗ tiêu đề N nằm sau header.
     */
    <nav
      aria-label="Mục lục báo cáo"
      className="bg-card sticky top-20 hidden max-h-[calc(100dvh-6rem)] flex-col overflow-y-auto rounded-xl border p-2 lg:flex"
    >
      <ul className="grid gap-0.5">
        {sections.map((section) => (
          <li key={section.number}>
            <button
              type="button"
              onClick={() => onSelect(section.number)}
              aria-current={activeSection === section.number ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-tight focus-visible:ring-2 focus-visible:outline-none",
                activeSection === section.number
                  ? "bg-primary-100 text-primary-700 font-semibold"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              <SectionStateIcon state={section.state} />
              <span className="text-muted-foreground font-mono">
                {section.number}
              </span>
              <span className="min-w-0 flex-1">{section.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground border-t px-2 pt-2 text-xs">
        <span className="font-mono font-semibold">{doneCount}/9</span> mục đã xong
      </p>
      <Legend />
    </nav>
  );
}

/**
 * Nút nhảy mục cho màn hẹp — mở ra bảng trượt liệt kê cả 9 mục.
 *
 * ## Vì sao KHÔNG dùng bước-tiếp-bước
 *
 * Chín bước liên tiếp trên điện thoại thì giáo viên không biết còn bao xa, và
 * lùi lại sửa một ô ở mục 2 là mất phương hướng. Đây là một trang cuộn liên tục
 * + nút nhảy mục dính ở đỉnh — cùng khuôn `TabPicker` mà repo đã dựng cho mục
 * lục 35 buổi flashcard ở `UX-MOBILE-1`.
 *
 * ## Hai con số, hai chỗ, không lẫn nhau
 *
 * Vị trí mục nằm ở tiền tố tên ("2. Chuyên cần…"), còn tiến độ ghi rõ chữ
 * `5/9 xong`. Ghi trơ `2/9` thì đọc thành "mục 2 trên 9" hay "2 mục đã xong
 * trên 9" đều được — tức là không nói được gì cả.
 */
export function ReportSectionPicker({
  sections,
  doneCount,
  activeSection,
  onSelect,
  className,
}: {
  sections: SectionStatus[];
  doneCount: number;
  activeSection: number;
  onSelect: (sectionNumber: number) => void;
  className?: string;
}) {
  const current =
    sections.find((section) => section.number === activeSection) ?? sections[0];
  if (!current) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          data-slot="report-section-picker"
          className={cn(
            "border-input bg-background text-foreground focus-visible:ring-ring flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-4 py-2 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none lg:hidden",
            className,
          )}
        >
          <SectionStateIcon state={current.state} />
          <span className="truncate">
            {current.number}. {current.title}
          </span>
          <span className="text-text-secondary ml-auto shrink-0 font-mono text-xs font-medium tabular-nums">
            {doneCount}/9 xong
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 rounded-t-2xl p-0"
      >
        <span
          className="bg-border mx-auto mt-3 h-1 w-9 shrink-0 rounded-full"
          aria-hidden
        />
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Mục lục báo cáo</SheetTitle>
          <SheetDescription>
            {doneCount} / 9 mục đã điền xong
            {doneCount < 9 ? ` · còn ${9 - doneCount} mục` : ""}
          </SheetDescription>
        </SheetHeader>

        <ul className="overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {sections.map((section) => {
            const isActive = section.number === activeSection;
            return (
              <li key={section.number}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(section.number)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-3 border-t px-5 py-3 text-left text-sm",
                      isActive ? "bg-accent font-semibold" : "text-text-secondary",
                    )}
                  >
                    <SectionStateIcon state={section.state} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block font-semibold">
                        {section.number}. {section.title}
                      </span>
                      {/*
                        Mục đang dở NÓI RÕ thiếu gì. Một dấu vàng không kèm câu
                        giải thích thì giáo viên phải mở ra dò từng ô.
                      */}
                      {section.hint && (
                        <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                          {section.hint}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <Check className="text-primary size-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </SheetTrigger>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
