"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { StudentFlashcardDeckOption } from "@/features/flashcards/server/queries";

/**
 * Màn chọn bộ thẻ của học viên (`MULTIDECK-1f`, user chốt 2026-07-29).
 *
 * ⚠️ Chỉ hiện khi khoá có **từ hai bộ trở lên**. Khoá một bộ — vẫn là đa số —
 * vào thẳng như trước, không thêm một cú bấm nào. Bắt cả lớp bấm qua một màn
 * chỉ có duy nhất một lựa chọn là lấy thời gian của số đông để phục vụ trường
 * hợp hiếm.
 *
 * Điều hướng bằng `router.push` chứ không state cục bộ: nội dung của bộ (ảnh đã
 * ký, danh sách trang) nằm ở máy chủ, và tải sẵn MỌI bộ chỉ để vẽ vài cái thẻ
 * chọn là đúng thứ `PERF-IMG-1` vừa mất một phiên để gỡ.
 */
export function StudentFlashcardDeckPicker({
  decks,
  courseName,
}: {
  decks: StudentFlashcardDeckOption[];
  courseName: string;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div>
          <h2 className="font-semibold">Chọn bộ thẻ</h2>
          <p className="text-muted-foreground text-sm">
            {courseName} có {decks.length} bộ flashcard.
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {decks.map((deck) => (
            <li key={deck.id}>
              <button
                type="button"
                onClick={() => router.push(`/student/review?deck=${deck.id}`)}
                className="border-student-sky-border bg-student-sky-surface hover:border-primary focus-visible:ring-ring flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-card flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Layers className="text-primary size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {deck.title}
                  </span>
                  {/*
                    `text-student-sky-ink` chứ không `muted-foreground`: nền
                    `--student-sky-surface` là nền màu, mà token phụ được chọn
                    cho nền TRẮNG sẽ tụt dưới ngưỡng AA trên nền màu (`DS-030`).
                  */}
                  <span className="text-student-sky-ink block truncate text-sm">
                    {deck.sectionCount} buổi
                    {deck.description ? ` · ${deck.description}` : ""}
                  </span>
                </span>
                <ChevronRight
                  className="text-student-sky-ink size-5 shrink-0"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
