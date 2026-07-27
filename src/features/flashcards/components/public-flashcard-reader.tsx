"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { StudentAudioPlayer } from "@/components/shared/student-audio-player";
import { Button } from "@/components/ui/button";
import type { Face } from "@/features/flashcards/components/flashcard-face";
import {
  FlashcardFrameControls,
  FlashcardFrameHeader,
  FlashcardFrameStage,
  FlashcardReaderFrame,
  FlashcardTapArea,
} from "@/features/flashcards/components/flashcard-reader-frame";
import { FlashcardSurface } from "@/features/flashcards/components/flashcard-surface";
import type { PublicFlashcardSectionView } from "@/features/flashcards/server/public-queries";

/**
 * Trình đọc thẻ của trang CÔNG KHAI `/t/<mã>`.
 *
 * Khác `StudentFlashcardReader` ở ba điểm, và đó là lý do nó là component riêng
 * chứ không phải thêm cờ vào cái cũ:
 *   1. **Không có gì cá nhân** — không ★, không tiến độ, không `toast`, và
 *      KHÔNG import server action nào. `tests/unit/security/public-surface-imports.test.ts`
 *      canh điều này bằng bài kiểm tĩnh.
 *   2. **Một buổi duy nhất**, không có thanh chọn buổi như màn học viên.
 *   3. **Khung LÀ cả trang** (`mode="page"`), không nằm trong vỏ dashboard.
 *
 * Hình học ba vùng (kể cả cử chỉ chạm/vuốt) dùng chung
 * `flashcard-reader-frame.tsx`, cơ chế lật 3D dùng chung
 * `flashcard-surface.tsx` — không chép lại.
 */
export function PublicFlashcardReader({
  data,
}: {
  data: PublicFlashcardSectionView;
}) {
  const pages = data.pages;
  const [index, setIndex] = useState(0);
  const [face, setFace] = useState<Face>("front");
  const [audioToken, setAudioToken] = useState<string | null>(null);

  const page = pages[Math.min(index, pages.length - 1)] ?? null;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= pages.length) return;
      setIndex(next);
      // Sang thẻ mới luôn bắt đầu từ mặt trước — nếu không, học sinh sẽ thấy
      // đáp án trước khi kịp nghĩ.
      setFace("front");
    },
    [pages.length],
  );

  const flip = useCallback(() => {
    setFace((current) => (current === "front" ? "back" : "front"));
  }, []);

  // Khung là cả trang nên `window` là phạm vi ĐÚNG cho phím mũi tên: không có
  // vùng nào khác trong trang tranh phím này.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index]);

  if (!page) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center">
        Buổi học này chưa có thẻ nào.
      </div>
    );
  }

  const audioUrl = page.audioUrl;
  const cardLabel =
    page.kind === "session_cover"
      ? "trang mở đầu"
      : (page.hanzi ?? "thẻ từ vựng");

  return (
    <FlashcardReaderFrame mode="page">
      <FlashcardFrameHeader
        title={`Buổi ${data.section.session_number} · ${data.section.title}`}
        counter={
          <>
            <span className="sr-only">Thẻ </span>
            {index + 1}/{pages.length}
          </>
        }
        progress={{
          value: index + 1,
          max: pages.length,
          label: "Tiến độ lướt thẻ",
        }}
      />

      <FlashcardFrameStage landmark>
        <FlashcardTapArea
          label={`Mặt ${face === "front" ? "trước" : "sau"} của ${cardLabel}. Nhấn Enter hoặc phím cách để lật.`}
          onFlip={flip}
          onNext={() => goTo(index + 1)}
          onPrevious={() => goTo(index - 1)}
        >
          {/*
            `fill`: thẻ cao đúng bằng vùng thẻ nên KHÔNG phải cuộn để đọc hết
            một mặt (user chốt 2026-07-25 cho cả hai màn). Việc "vừa nội dung"
            nằm trong từng mặt: mặt trước cho ảnh co, mặt sau thu cỡ chữ.
          */}
          <FlashcardSurface
            page={page}
            face={face}
            className=""
            durationClassName="duration-300"
            fill
          />
        </FlashcardTapArea>
      </FlashcardFrameStage>

      <FlashcardFrameControls>
        {audioUrl ? (
          <StudentAudioPlayer
            src={audioUrl}
            label={`Phát âm ${cardLabel}`}
            appearance="button"
            density="compact"
            autoPlayToken={audioToken}
          />
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            // 48px trên điện thoại (vẫn trên ngưỡng 44px), 56px từ `sm` trở
            // lên: hàng ba nút phải vừa 288px của máy 320px kể cả khi nhãn
            // "Lật thẻ" giữ nguyên cỡ chữ 16px.
            className="size-12 shrink-0 rounded-full sm:size-14"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            aria-label="Thẻ trước"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Button>

          {/* CTA chính DUY NHẤT của màn hình — hai nút mũi tên và audio là phụ. */}
          <Button
            type="button"
            className="h-12 min-w-0 flex-1 gap-2 text-base sm:h-14"
            onClick={flip}
          >
            <RotateCw className="size-5" aria-hidden />
            Lật thẻ
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-full sm:size-14"
            disabled={index === pages.length - 1}
            onClick={() => {
              goTo(index + 1);
              setAudioToken(null);
            }}
            aria-label="Thẻ tiếp theo"
          >
            <ChevronRight className="size-6" aria-hidden />
          </Button>
        </div>
      </FlashcardFrameControls>
    </FlashcardReaderFrame>
  );
}
