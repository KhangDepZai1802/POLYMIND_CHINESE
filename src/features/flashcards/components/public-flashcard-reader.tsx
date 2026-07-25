"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { StudentAudioPlayer } from "@/components/shared/student-audio-player";
import { Button } from "@/components/ui/button";
import type { Face } from "@/features/flashcards/components/flashcard-face";
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
 *   3. **Bố cục toàn màn hình** ba vùng cho điện thoại, thay vì nằm trong khung
 *      dashboard.
 *
 * Cơ chế lật 3D dùng chung `flashcard-surface.tsx` — không chép lại.
 */

/** Vuốt phải vượt ngưỡng này mới tính là chuyển thẻ. */
const SWIPE_DISTANCE_PX = 50;

/**
 * Ngón di chuyển quá ngưỡng này thì coi là CUỘN/VUỐT, không phải "chạm để lật".
 *
 * Không có ngưỡng thì mỗi lần cuộn đọc câu ví dụ ở mặt sau, thẻ lại tự lật.
 */
const TAP_SLOP_PX = 10;

/**
 * Dải mép màn hình dành cho cử chỉ của HỆ ĐIỀU HÀNH.
 *
 * iOS vuốt-để-quay-lại và Android predictive back đều bắt đầu từ mép ngang.
 * Nhận vuốt ở đó là cướp nút Quay lại của cả máy — người dùng sẽ tưởng máy hỏng.
 */
const SYSTEM_GESTURE_EDGE_PX = 24;

export function PublicFlashcardReader({
  data,
}: {
  data: PublicFlashcardSectionView;
}) {
  const pages = data.pages;
  const [index, setIndex] = useState(0);
  const [face, setFace] = useState<Face>("front");
  const [audioToken, setAudioToken] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

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
    <div className="fc-public flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* ---------------------------------------------------------------
          VÙNG 1 — đầu trang. Nằm NGOÀI vùng cuộn nên không cần `sticky`.
          --------------------------------------------------------------- */}
      <header className="shrink-0 px-[max(1rem,env(safe-area-inset-left))] pt-2 pb-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="truncate text-sm font-semibold">
            Buổi {data.section.session_number} · {data.section.title}
          </h1>
          {/* Số thẻ dùng chữ số đều bề rộng để không nhảy khi sang thẻ hai chữ số. */}
          <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
            <span className="sr-only">Thẻ </span>
            {index + 1}/{pages.length}
          </p>
        </div>
        {/*
          Thanh tiến độ thay vì dãy chấm: buổi 30 thẻ thì 30 chấm không vừa
          màn 320px, còn thanh thì luôn vừa.
        */}
        <div
          className="bg-muted mt-1.5 h-[3px] overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={pages.length}
          aria-valuenow={index + 1}
          aria-label="Tiến độ lướt thẻ"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-240 motion-reduce:transition-none"
            style={{ width: `${((index + 1) / pages.length) * 100}%` }}
          />
        </div>
      </header>

      {/* ---------------------------------------------------------------
          VÙNG 2 — thẻ. `min-h-0` là bắt buộc: thiếu nó thì flex item không co
          được dưới nội dung, thẻ dài sẽ đẩy thanh điều khiển ra khỏi màn hình.
          --------------------------------------------------------------- */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] py-2">
        {/*
          `min-h-full` chứ KHÔNG `h-full`.

          Với `h-full` + `items-center`, thẻ cao hơn vùng cuộn sẽ bị căn giữa
          RỒI tràn cả hai đầu — mà phần tràn lên trên thì không cuộn tới được
          (lỗi kinh điển của flex-centering trong vùng cuộn). `min-h-full` cho
          khung nở theo thẻ: thẻ ngắn vẫn căn giữa, thẻ dài thì cuộn đủ từ đầu
          tới cuối.
        */}
        <div className="mx-auto flex min-h-full w-full max-w-xl items-center">
          <div
            className="fc-public-card focus-visible:ring-ring w-full cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            role="button"
            tabIndex={0}
            aria-label={`Mặt ${face === "front" ? "trước" : "sau"} của ${cardLabel}. Nhấn Enter hoặc phím cách để lật.`}
            onClick={() => {
              if (moved.current) return;
              flip();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flip();
              }
            }}
            onTouchStart={(event) => {
              const touch = event.changedTouches[0];
              if (!touch) return;
              moved.current = false;
              // Chạm bắt đầu trong dải mép ngang thì KHÔNG nhận cử chỉ vuốt:
              // dải đó là của hệ điều hành.
              const width = window.innerWidth;
              const inEdgeZone =
                touch.clientX < SYSTEM_GESTURE_EDGE_PX ||
                touch.clientX > width - SYSTEM_GESTURE_EDGE_PX;
              touchStart.current = inEdgeZone
                ? null
                : { x: touch.clientX, y: touch.clientY };
            }}
            onTouchMove={(event) => {
              const start = touchStart.current;
              const touch = event.changedTouches[0];
              if (!start || !touch) return;
              if (
                Math.abs(touch.clientX - start.x) > TAP_SLOP_PX ||
                Math.abs(touch.clientY - start.y) > TAP_SLOP_PX
              ) {
                moved.current = true;
              }
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              const touch = event.changedTouches[0];
              touchStart.current = null;
              if (!start || !touch) return;

              const dx = touch.clientX - start.x;
              // Vuốt phải là NGANG: lệch dọc lớn hơn thì đó là cuộn đọc nội dung.
              if (
                Math.abs(dx) >= SWIPE_DISTANCE_PX &&
                Math.abs(dx) > Math.abs(touch.clientY - start.y)
              ) {
                goTo(dx < 0 ? index + 1 : index - 1);
              }
            }}
          >
            <FlashcardSurface
              page={page}
              face={face}
              className=""
              durationClassName="duration-300"
            />
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------------------
          VÙNG 3 — điều khiển. Luôn thấy được, không phải cuộn đi tìm.
          Vuốt chỉ là đường bổ sung; đây mới là đường chính (`gesture-alternative`).
          --------------------------------------------------------------- */}
      <nav
        aria-label="Điều khiển thẻ"
        className="bg-card/95 shrink-0 border-t px-[max(1rem,env(safe-area-inset-left))] py-2 backdrop-blur"
      >
        {/*
          🔴 HAI HÀNG, không phải một — sửa lỗi "mất nút mũi tên phải" (user báo
          2026-07-25).

          Bản cũ đổ cả bốn thứ vào MỘT hàng `flex`: [◀] [Lật thẻ] [trình phát]
          [▶]. Nhưng `StudentAudioPlayer` không phải một nút — nó là một khối
          `flex-wrap` gồm nút phát + chữ "Tốc độ" + ba nút tốc độ, rộng tối thiểu
          ~390px và KHÔNG co nhỏ hơn được. Trên máy 360px, hàng đó cần ~500px
          trong 328px có thật: hai nút mũi tên mang `shrink-0`, "Lật thẻ" đã co
          hết cỡ, nên phần dư tràn sang phải và bị `overflow-hidden` của khung
          ngoài **cắt đứt nút ▶**. Lỗi im lặng đúng nghĩa: không cuộn ngang,
          không cảnh báo, `scrollWidth` vẫn bằng `clientWidth` nên bài kiểm cũ
          vẫn xanh — chỉ người dùng là mất nút.

          Cách xếp mới đặt mỗi hàng một việc, nên không hàng nào phải giành chỗ:
            • hàng trên: audio (chỉ hiện khi thẻ có audio) — `density="compact"`
              để vừa 288px của máy 320px;
            • hàng dưới: điều hướng [◀] [Lật thẻ] [▶] — CTA chính nằm SÁT ĐÁY,
              chỗ ngón tay với tới dễ nhất, và hai mũi tên luôn ở đúng hai mép.
        */}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
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
        </div>
      </nav>
    </div>
  );
}
