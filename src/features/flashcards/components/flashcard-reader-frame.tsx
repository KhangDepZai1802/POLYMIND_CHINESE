"use client";

import { useRef, type KeyboardEventHandler, type ReactNode } from "react";

/**
 * KHUNG ĐỌC THẺ — hình học dùng chung cho **trang công khai `/t/<mã>`** và
 * **màn Ôn tập của học viên**.
 *
 * Lý do file này tồn tại: user chốt 2026-07-25 rằng màn Ôn tập phải dùng đúng
 * giao diện của trang QR (*"tôi rất thích giao diện flashcard công khai từ mã QR
 * này, áp dụng giao diện này cho giao diện flashcard trong module ôn tập"*).
 * Cách dễ nhất là chép khối JSX của `public-flashcard-reader.tsx` sang — và đó
 * đúng là hình dạng `BUG_M10_01`: hai đường code cùng dựng một thứ rồi trôi khác
 * nhau ở chỗ nhìn thấy được. Mà chính khối này là thứ vừa tốn một đợt sửa lỗi
 * (`BUG-P17-002`/`BUG-P17-003`): `min-h-0` cho vùng cuộn, `min-h-full` thay vì
 * `h-full` để phần tràn phía trên cuộn tới được, safe-area cho tai thỏ và thanh
 * gesture, thanh điều khiển hai hàng để nút mũi tên không bị cắt. Nên nó được
 * tách ra đây và **cả hai màn cùng gọi**.
 *
 * Ba vùng, cố định theo thứ tự: `FlashcardFrameHeader` · `FlashcardFrameStage` ·
 * `FlashcardFrameControls`. Vùng giữa là vùng DUY NHẤT cuộn được; hai vùng kia
 * `shrink-0` nên luôn thấy được mà không phải cuộn đi tìm.
 *
 * ⛔ Đừng thêm `max-height` cho thẻ ở bất cứ đâu trong khung này. Thẻ cao theo
 * nội dung là điều kiện của bài "chữ KHÔNG bị cắt" (`flashcard-responsive.spec.ts`);
 * nội dung dài thì VÙNG GIỮA cuộn, không phải thẻ bị bóp.
 */

/**
 * Ba hình dạng của khung, mỗi cái một dòng class:
 *
 * - `page` — khung LÀ cả trang (trang công khai `/t/<mã>`). `h-dvh` vì không có
 *   vỏ dashboard nào bao ngoài.
 * - `fullscreen` — khung PHỦ LÊN trang đã có (màn Ôn tập). `fixed inset-0` thay
 *   vì `h-dvh`: nó che vỏ dashboard ngay từ lần vẽ đầu tiên nên **không có cú
 *   nháy** "hiện header rồi mới ẩn". CSS `html[data-flashcard-focus="true"]`
 *   trong `globals.css` dọn phần còn lại (ẩn chrome, khoá cuộn nền).
 * - `inline` — khung nằm TRONG luồng trang, cao theo `dvh` nhưng có trần: dùng
 *   khi học viên thoát toàn màn hình mà vẫn đang ở tab Flashcard. Không có
 *   trạng thái chết: thoát toàn màn hình vẫn còn đủ nút để học tiếp.
 */
export type FlashcardFrameMode = "page" | "fullscreen" | "inline";

const FRAME_SHAPE: Record<FlashcardFrameMode, string> = {
  page: "h-dvh",
  fullscreen: "bg-surface-page fixed inset-0 z-40",
  // `70dvh` (trần `42rem`) là mức đo được cho vừa: trên máy 360×800, header +
  // tiêu đề "Ôn tập" + hai tab đã tiêu 264px, nên khung cao hơn thế là đẩy nút
  // "Lật thẻ" xuống dưới mép màn. Dạng này CỐ Ý vẫn cho trang cuộn một chút —
  // người dùng bấm ✕ chính là để thấy lại ngữ cảnh trang.
  inline: "bg-card relative h-[min(70dvh,42rem)] rounded-2xl border shadow-sm",
};

export function FlashcardReaderFrame({
  mode,
  onKeyDown,
  children,
}: {
  mode: FlashcardFrameMode;
  /**
   * Mũi tên ← → của màn Ôn tập gắn Ở ĐÂY chứ không phải ở `window`.
   *
   * Trang công khai nghe ở `window` vì khung là cả trang, không có gì khác để
   * tranh phím. Màn Ôn tập thì khung chỉ là một vùng trong trang: nghe ở
   * `window` sẽ cướp phím mũi tên của việc cuộn trang khi khung đang ở dạng
   * `inline`.
   */
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      data-flashcard-frame={mode}
      onKeyDown={onKeyDown}
      className={`fc-frame flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${FRAME_SHAPE[mode]}`}
    >
      {children}
    </div>
  );
}

export function FlashcardFrameHeader({
  as: Heading = "h1",
  title,
  counter,
  progress,
  leading,
  trailing,
  children,
}: {
  /**
   * Trang công khai là `h1` (khung là cả trang). Màn Ôn tập là `h2`: trang đó
   * đã có `h1` "Ôn tập" của `PageHeader`, thêm `h1` thứ hai là phá thứ bậc tiêu
   * đề (`heading-hierarchy`).
   */
  as?: "h1" | "h2";
  title: string;
  /** Chuỗi đếm thẻ. `ReactNode` để trang công khai kèm được tiền tố sr-only. */
  counter: ReactNode;
  progress: { value: number; max: number; label: string };
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 px-[max(1rem,env(safe-area-inset-left))] pt-2 pb-1.5">
      <div className="flex items-center gap-2">
        {leading}
        <Heading className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </Heading>
        {/*
          Chữ số đều bề rộng để không nhảy khi sang thẻ hai chữ số.
          `aria-live` để người dùng trình đọc màn hình biết đã sang thẻ khác —
          nút bấm không tự thông báo điều đó.
        */}
        <p
          aria-live="polite"
          className="text-muted-foreground shrink-0 text-sm tabular-nums"
        >
          {counter}
        </p>
        {trailing}
      </div>
      {/*
        Thanh tiến độ thay vì dãy chấm: buổi 30 thẻ thì 30 chấm không vừa màn
        320px, còn thanh thì luôn vừa.
      */}
      <div
        className="bg-muted mt-1.5 h-[3px] overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={progress.max}
        aria-valuenow={progress.value}
        aria-label={progress.label}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-240 motion-reduce:transition-none"
          style={{ width: `${(progress.value / progress.max) * 100}%` }}
        />
      </div>
      {children}
    </header>
  );
}

export function FlashcardFrameStage({
  landmark = false,
  maxWidthClassName = "max-w-xl",
  children,
}: {
  /**
   * `true` ⇒ dựng bằng `<main>`. CHỈ trang công khai được bật: màn Ôn tập nằm
   * trong `<main id="noi-dung-chinh">` của vỏ dashboard, lồng `main` trong
   * `main` là lỗi axe (`landmark-unique`).
   */
  landmark?: boolean;
  maxWidthClassName?: string;
  children: ReactNode;
}) {
  const Stage = landmark ? "main" : "div";
  return (
    <Stage className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] py-2">
      {/*
        `min-h-full` chứ KHÔNG `h-full`.

        Với `h-full` + `items-center`, thẻ cao hơn vùng cuộn sẽ bị căn giữa RỒI
        tràn cả hai đầu — mà phần tràn lên trên thì không cuộn tới được (lỗi
        kinh điển của flex-centering trong vùng cuộn). `min-h-full` cho khung nở
        theo thẻ: thẻ ngắn vẫn căn giữa, thẻ dài thì cuộn đủ từ đầu tới cuối.
      */}
      <div
        className={`mx-auto flex min-h-full w-full items-center ${maxWidthClassName}`}
      >
        {children}
      </div>
    </Stage>
  );
}

export function FlashcardFrameControls({
  maxWidthClassName = "max-w-xl",
  children,
}: {
  maxWidthClassName?: string;
  children: ReactNode;
}) {
  return (
    /*
      🔴 MỖI HÀNG MỘT VIỆC — đây là bản sửa `BUG-P17-002`.

      Bản cũ đổ audio và hai nút mũi tên vào cùng MỘT hàng `flex`. Nhưng trình
      phát không phải một nút: nó là khối `flex-wrap` rộng tối thiểu ~390px và
      không co nhỏ hơn được, nên trên máy 360px phần dư tràn ra và bị
      `overflow-hidden` **cắt đứt nút mũi tên phải**. Xếp mỗi hàng một việc thì
      không hàng nào phải giành chỗ.
    */
    <nav
      aria-label="Điều khiển thẻ"
      className="bg-card/95 shrink-0 border-t px-[max(1rem,env(safe-area-inset-left))] py-2 backdrop-blur"
    >
      <div
        className={`mx-auto flex w-full flex-col gap-2 ${maxWidthClassName}`}
      >
        {children}
      </div>
    </nav>
  );
}

/** Vuốt ngang vượt ngưỡng này mới tính là chuyển thẻ. */
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

/**
 * Vùng chạm của thẻ: chạm để lật, vuốt ngang để chuyển thẻ.
 *
 * Cử chỉ ở đây LUÔN là đường bổ sung — mọi việc nó làm đều có nút riêng ở vùng
 * điều khiển (`gesture-alternative`). Vuốt là thứ người dùng phải đoán ra, nút
 * thì không.
 */
export function FlashcardTapArea({
  label,
  disabled = false,
  onFlip,
  onNext,
  onPrevious,
  children,
}: {
  label: string;
  disabled?: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrevious: () => void;
  children: ReactNode;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return (
    <div
      className={`fc-frame-card focus-visible:ring-ring relative w-full rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={label}
      onClick={() => {
        if (disabled || moved.current) return;
        onFlip();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFlip();
        }
      }}
      onTouchStart={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        moved.current = false;
        // Chạm bắt đầu trong dải mép ngang thì KHÔNG nhận cử chỉ vuốt: dải đó
        // là của hệ điều hành.
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
        if (disabled || !start || !touch) return;

        const dx = touch.clientX - start.x;
        // Vuốt là NGANG: lệch dọc lớn hơn thì đó là cuộn đọc nội dung.
        if (
          Math.abs(dx) >= SWIPE_DISTANCE_PX &&
          Math.abs(dx) > Math.abs(touch.clientY - start.y)
        ) {
          if (dx < 0) onNext();
          else onPrevious();
        }
      }}
    >
      {children}
    </div>
  );
}
