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

        {/*
          🔴 `min-w-0` trên `<li>` là BẮT BUỘC, không phải cho chắc: `<li>` là
          **grid item**, mà grid item mặc định `min-width: auto` ⇒ bề rộng tối
          thiểu của nó bằng min-content của nội dung bên trong. Thiếu nó, ở
          375px trang tràn phải **544px** (đo Chromium 2026-08-05, user báo kèm
          ảnh). Đây là lần **thứ tư** repo dính đúng hình dạng lỗi này —
          `UX-UIUX-M16-002`, `UX-ENROLL-1`, `UX-STUDENTS-1`.
        */}
        <ul className="grid gap-2 sm:grid-cols-2">
          {decks.map((deck) => (
            <li key={deck.id} className="min-w-0">
              <button
                type="button"
                onClick={() => router.push(`/student/review?deck=${deck.id}`)}
                className="border-student-sky-border bg-student-sky-surface hover:border-primary focus-visible:ring-ring flex min-h-16 w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-card flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Layers className="text-primary size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  {/*
                    ⛔ KHÔNG dùng `truncate` cho tên bộ. Hai lý do, cả hai đều
                    thật với dữ liệu production:

                    1. `truncate` mang `white-space: nowrap`, tức min-content
                       của thẻ = **cả dòng chữ** — chính là thứ vừa làm tràn
                       544px. Cho chữ xuống dòng thì min-content chỉ còn một
                       TỪ, lỗi không tái diễn được về mặt cấu trúc.
                    2. Tên hai bộ của khoá VCB chỉ khác nhau ở đầu chuỗi rồi
                       trùng nhau phần đuôi ("… Tiếng Trung Đàm Phán Tài Chính
                       Chiến Lược"). Cắt một dòng thì trên màn hẹp cả hai thẻ
                       hiện gần như cùng một câu — người học phải đoán.

                    `line-clamp-2` giữ được cả hai: xuống dòng, nhưng chặn ở 2
                    dòng để thẻ không cao vô hạn.
                  */}
                  <span className="line-clamp-2 font-medium break-words">
                    {deck.title}
                  </span>
                  {/*
                    `text-student-sky-ink` chứ không `muted-foreground`: nền
                    `--student-sky-surface` là nền màu, mà token phụ được chọn
                    cho nền TRẮNG sẽ tụt dưới ngưỡng AA trên nền màu (`DS-030`).
                  */}
                  {/*
                    ⛔ KHÔNG thêm `block` cạnh `line-clamp-2`: `line-clamp-*`
                    đặt `display: -webkit-box`, `block` ghi đè lên đúng thuộc
                    tính đó và chặn dòng **im lặng mất tác dụng** — đo ở 375px
                    ra 5 dòng thay vì 2.
                  */}
                  <span className="text-student-sky-ink mt-0.5 line-clamp-2 text-sm break-words">
                    {deck.sectionCount} buổi
                    {deck.description ? ` · ${deck.description}` : ""}
                  </span>
                </span>
                <ChevronRight
                  className="text-student-sky-ink mt-2.5 size-5 shrink-0"
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
