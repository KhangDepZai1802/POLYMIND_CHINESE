"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  Play,
  RotateCw,
  Star,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StudentAudioPlayer } from "@/components/shared/student-audio-player";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFlashcardImagePrefetch } from "@/features/flashcards/client/use-flashcard-image-prefetch";
import { type Face } from "@/features/flashcards/components/flashcard-face";
import {
  FlashcardFrameControls,
  FlashcardFrameHeader,
  FlashcardFrameStage,
  FlashcardReaderFrame,
  FlashcardTapArea,
} from "@/features/flashcards/components/flashcard-reader-frame";
import { FlashcardStartHint } from "@/features/flashcards/components/flashcard-start-hint";
import { FlashcardSurface } from "@/features/flashcards/components/flashcard-surface";
import { setFlashcardStarAction } from "@/features/flashcards/server/actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";

/**
 * Bề rộng tối đa của vùng thẻ.
 *
 * Rộng hơn `max-w-xl` của trang công khai vì màn này còn được xem trên laptop —
 * nhưng vẫn có trần: dòng chữ dài quá 75 ký tự là khó đọc (`line-length`).
 */
const FRAME_WIDTH = "max-w-xl sm:max-w-2xl";

type PageDirection = "next" | "previous";
type PageTransition = {
  sectionId: string;
  fromIndex: number;
  /** Mặt của trang cũ tại lúc rời đi — trang cũ đã được reset về mặt trước. */
  fromFace: Face;
  direction: PageDirection;
};

export function StudentFlashcardReader({
  deck,
  courseName,
  starredPageIds = [],
  canSwitchDeck = false,
}: {
  deck: FlashcardDeckView | null;
  courseName: string | null;
  starredPageIds?: string[];
  /**
   * Khoá có nhiều bộ thẻ ⇒ hiện đường quay lại màn chọn bộ (`MULTIDECK-1f`).
   * Khoá một bộ thì `false` và không có nút nào thừa ra.
   */
  canSwitchDeck?: boolean;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState<Set<string>>(
    () => new Set(starredPageIds),
  );
  const [starPending, setStarPending] = useState(false);
  const sections = useMemo(
    () => deck?.sections.filter((section) => section.pages.length > 0) ?? [],
    [deck],
  );
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? null);
  const [pageBySection, setPageBySection] = useState<Record<string, number>>(
    {},
  );
  const [faceByPage, setFaceByPage] = useState<Record<string, Face>>({});
  const [pageTransition, setPageTransition] = useState<PageTransition | null>(
    null,
  );
  /**
   * `false` ⇒ hiện TRANG MỞ ĐẦU của module (thẻ giới thiệu + nút "Bắt đầu ôn
   * thẻ"); `true` ⇒ khung đọc thẻ toàn màn hình.
   *
   * Mặc định `false` là quyết định của user 2026-07-25, và nó giải một cặp lo
   * ngại ngược nhau: vào thẳng toàn màn hình thì *"người kém công nghệ sẽ không
   * biết sự tồn tại của Ôn Tập Câu Sai"*; còn hiện trang có hai tab thì *"sợ
   * người ta không biết cách làm rồi complain web dỏm"*. Chốt: hiện hai tab, kèm
   * `FlashcardStartHint` — mũi tên động chỉ vào nút, có ✕ và "Không nhắc lại".
   */
  const [reading, setReading] = useState(false);

  const section =
    sections.find((candidate) => candidate.id === sectionId) ??
    sections[0] ??
    null;

  /**
   * ⛔ XÁO TRỘN / THỨ TỰ GỐC / PHÁT TỰ ĐỘNG đã BỎ HẲN (user chốt 2026-07-25:
   * *"bỏ luôn 3 nút xáo trộn, thứ tự gốc và phát tự động (bỏ hẳn 3 chức năng
   * này)"*). Đừng dựng lại: chúng chiếm hai hàng nút trong khung một-màn-hình,
   * tức lấy đúng chỗ của cái thẻ. Quyết định cũ `Q6`/`P16-T6` vì thế **hết hiệu
   * lực** — xem `docs/08-phase-plan.md`.
   *
   * Thứ tự thẻ nay luôn là thứ tự gốc của buổi.
   */
  const orderedPages = section?.pages ?? [];

  const rawPageIndex = section ? (pageBySection[section.id] ?? 0) : 0;
  const pageIndex = section
    ? Math.min(rawPageIndex, Math.max(orderedPages.length - 1, 0))
    : 0;
  const page = orderedPages[pageIndex] ?? null;
  const face = page ? (faceByPage[page.id] ?? "front") : "front";
  const outgoingPage =
    section && pageTransition?.sectionId === section.id
      ? (orderedPages[pageTransition.fromIndex] ?? null)
      : null;
  const outgoingFace = pageTransition?.fromFace ?? "front";

  /**
   * Cờ trên `<html>` cho `globals.css` ẩn chrome + khoá cuộn nền.
   *
   * Dọn ở hàm cleanup nên MỌI đường ra đều trả chrome về: bấm ✕, đổi sang tab
   * "Ôn Tập Câu Sai" (Radix unmount nội dung tab cũ), hay rời trang. Không dọn ⇒
   * học viên bấm sang tab khác và thấy một trang không header, không cuộn được —
   * lỗi im lặng không có đường thoát.
   */
  useEffect(() => {
    if (!reading) return;
    const root = document.documentElement;
    root.dataset.flashcardFocus = "true";
    return () => {
      delete root.dataset.flashcardFocus;
    };
  }, [reading]);

  useEffect(() => {
    if (!pageTransition) return;

    const fallbackTimer = window.setTimeout(() => {
      setPageTransition(null);
    }, 520);

    return () => window.clearTimeout(fallbackTimer);
  }, [pageTransition]);

  /*
   * Kéo ngầm ảnh của các thẻ lân cận (`PERF-IMG-1`).
   *
   * ⚠️ Phải nằm TRÊN mọi `return` sớm bên dưới — hook không được gọi có điều
   * kiện. Việc "có chạy hay không" vì thế là cờ `enabled`, không phải vị trí gọi.
   *
   * `enabled: reading` là có chủ ý: khi học viên còn ở trang mở đầu module thì
   * chưa chắc họ sẽ ôn thẻ, mà đây là màn hình mở bằng 4G. Tự ý kéo vài MB về
   * máy người chỉ ghé qua tab là lấy tiền data của họ để mua tốc độ cho người
   * khác.
   */
  useFlashcardImagePrefetch(orderedPages, pageIndex, { enabled: reading });

  if (!courseName) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={BookOpen}
            title="Bạn chưa có lớp đang học"
            description="Flashcard sẽ xuất hiện khi bạn có lớp và khóa học đang hoạt động."
          />
        </CardContent>
      </Card>
    );
  }

  if (!deck || sections.length === 0 || !section || !page) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={BookOpen}
            title="Chưa có flashcard để ôn"
            description={`Nội dung đã công bố cho ${courseName} sẽ xuất hiện tại đây.`}
          />
        </CardContent>
      </Card>
    );
  }

  // Tên gọi của trang: Hán tự với thẻ từ vựng, tên buổi với trang mở đầu.
  const pageTitle =
    page.kind === "vocabulary" ? (page.hanzi ?? section.title) : section.title;

  function navigate(nextIndex: number) {
    if (
      !section ||
      pageTransition ||
      nextIndex < 0 ||
      nextIndex >= orderedPages.length
    ) {
      return;
    }
    const leavingPage = orderedPages[pageIndex];
    setPageTransition({
      sectionId: section.id,
      fromIndex: pageIndex,
      fromFace: leavingPage ? (faceByPage[leavingPage.id] ?? "front") : "front",
      direction: nextIndex > pageIndex ? "next" : "previous",
    });
    // Rời trang nào thì trang đó quay lại mặt trước cho lần xem sau.
    if (leavingPage) {
      setFaceByPage((current) => ({ ...current, [leavingPage.id]: "front" }));
    }
    setPageBySection((current) => ({ ...current, [section.id]: nextIndex }));
  }

  function toggleFace() {
    if (!page || pageTransition) return;
    setFaceByPage((current) => ({
      ...current,
      [page.id]: (current[page.id] ?? "front") === "front" ? "back" : "front",
    }));
  }

  /**
   * Gửi trạng thái MONG MUỐN, không phải "đảo". Bấm nhanh hai lần vì thế cho
   * cùng một kết quả, khớp với khoá chính ghép ở DB (`BUG_M09_01`).
   * Cập nhật giao diện trước rồi hoàn tác nếu server từ chối.
   */
  function setStar(pageId: string, nextStarred: boolean) {
    if (starPending) return;
    setStarPending(true);
    setStarred((current) => {
      const next = new Set(current);
      if (nextStarred) next.add(pageId);
      else next.delete(pageId);
      return next;
    });
    void setFlashcardStarAction({ pageId, starred: nextStarred })
      .then((result) => {
        if (!result.error) return;
        toast.error(result.error);
        setStarred((current) => {
          const next = new Set(current);
          if (nextStarred) next.delete(pageId);
          else next.add(pageId);
          return next;
        });
      })
      .finally(() => setStarPending(false));
  }

  /**
   * TRANG MỞ ĐẦU của module (user chốt 2026-07-25).
   *
   * Không dựng khung đọc ngay khi vào tab: hai tab "Flashcard Từ Vựng" và "Ôn
   * Tập Câu Sai" phải thấy được trước, nếu không người mới không biết module có
   * phần thứ hai. Nhưng chỉ để hai tab thì lại có người không biết bấm đâu để
   * học — nên có `FlashcardStartHint` chỉ đường bằng mũi tên động.
   *
   * Một CTA duy nhất, cao 56px, và là thứ đập vào mắt đầu tiên (`primary-action`).
   */
  if (!reading) {
    const cardCount = sections.reduce(
      (total, candidate) => total + candidate.pages.length,
      0,
    );
    return (
      <div className="space-y-3">
        <FlashcardStartHint />
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold">{deck.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {courseName} · {cardCount} thẻ · {sections.length} buổi đã mở
                </p>
              </div>
              {/*
                Đường quay lại màn chọn bộ. Dạng nút viền, KHÔNG phải nút chính:
                mỗi màn một CTA, và CTA ở đây là "Bắt đầu ôn thẻ"
                (`primary-action`).
              */}
              {canSwitchDeck && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/student/review")}
                >
                  <Layers className="size-4" aria-hidden />
                  Đổi bộ thẻ
                </Button>
              )}
            </div>
            <Button
              type="button"
              className="h-14 w-full gap-2 text-base"
              onClick={() => setReading(true)}
            >
              <Play className="size-5" aria-hidden />
              Bắt đầu ôn thẻ
            </Button>
            <p className="text-muted-foreground text-sm">
              Thẻ mở toàn màn hình cho dễ đọc. Bấm ✕ ở góc trên bên trái để quay
              lại đây.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FlashcardReaderFrame
      mode="fullscreen"
      /*
       * Phím mũi tên nghe Ở KHUNG, không ở `window`: khung này là một vùng
       * trong trang Ôn tập (khác trang công khai, nơi khung là cả trang), nên
       * nghe ở `window` là cướp phím của phần còn lại của trang.
       */
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navigate(pageIndex + 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigate(pageIndex - 1);
        }
      }}
    >
      <FlashcardFrameHeader
        // `h2`: trang Ôn tập đã có `h1` "Ôn tập" của `PageHeader`.
        as="h2"
        title={`Buổi ${section.session_number} · ${section.title}`}
        // Giữ nguyên chữ "Trang N/M" của bản cũ — đây là cách học viên (và bài
        // kiểm E2E) nhận ra mình đang ở thẻ nào.
        counter={`Trang ${pageIndex + 1}/${orderedPages.length}`}
        progress={{
          value: pageIndex + 1,
          max: orderedPages.length,
          label: "Tiến độ lướt thẻ",
        }}
        leading={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            aria-label="Thoát ôn thẻ"
            title="Thoát ôn thẻ"
            onClick={() => setReading(false)}
          >
            <X className="size-5" aria-hidden />
          </Button>
        }
        trailing={
          /*
           * ★ thu về đúng một nút 44px (user chốt 2026-07-25).
           *
           * Bản cũ mang cả chữ "Đánh dấu khó"/"Đã đánh dấu khó" — tiêu ~130px
           * bề ngang, đúng phần đang thiếu ở máy 320px. Tên gọi cho trình đọc
           * màn hình VẪN là cả câu đó qua `aria-label`, nên không mất thông tin;
           * `aria-pressed` + nền đầy khi đã đánh dấu là hai chỉ dấu không dựa
           * vào riêng màu.
           */
          page.kind === "vocabulary" ? (
            <Button
              type="button"
              variant={starred.has(page.id) ? "default" : "outline"}
              size="icon"
              className="size-11 shrink-0 rounded-full"
              disabled={starPending}
              aria-pressed={starred.has(page.id)}
              aria-label={
                starred.has(page.id) ? "Đã đánh dấu khó" : "Đánh dấu khó"
              }
              title={starred.has(page.id) ? "Đã đánh dấu khó" : "Đánh dấu khó"}
              onClick={() => setStar(page.id, !starred.has(page.id))}
            >
              <Star
                className={`size-5 ${starred.has(page.id) ? "fill-current" : ""}`}
                aria-hidden
              />
            </Button>
          ) : null
        }
      >
        {/*
          Mục lục buổi: cuộn ngang vì một khoá có tới 35 buổi.

          Nút `h-9` (36px) — LÙN hơn ngưỡng 44px một cách CÓ CHỦ Ý, theo yêu cầu
          user 2026-07-25 (*"chỗ mục lục buổi có thể cho nút nó lùn lại hơn xíu
          để flashcard có thêm khoảng trống"*). Đánh đổi đã cân: đây là hàng
          chuyển buổi, dùng thưa và các nút cách nhau 8px; ba control chính của
          màn (◀ Lật thẻ ▶) vẫn 48px. Trên cảm ứng `globals.css` còn ép
          `min-height: 44px` nên thực tế ngón tay vẫn có 44px — 36px chỉ áp cho
          con trỏ chuột.

          Chỉ dựng khi có TỪ HAI BUỔI trở lên: một buổi thì hàng nút này không
          chọn được gì khác mà vẫn lấy chỗ của thẻ.
        */}
        {sections.length > 1 && (
          <nav
            aria-label="Mục lục buổi flashcard"
            className="mt-1.5 flex gap-2 overflow-x-auto pb-1"
          >
            {sections.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                size="sm"
                variant={candidate.id === section.id ? "default" : "outline"}
                className="h-9 shrink-0"
                onClick={() => {
                  setPageTransition(null);
                  setSectionId(candidate.id);
                }}
              >
                Buổi {candidate.session_number}
              </Button>
            ))}
          </nav>
        )}
      </FlashcardFrameHeader>

      <FlashcardFrameStage maxWidthClassName={FRAME_WIDTH}>
        {/*
          `h-full` xuyên suốt từ vùng thẻ xuống tới mặt thẻ: đó là điều kiện để
          thẻ vừa khít MỘT khung hình. Thẻ cao theo nội dung (cơ chế cũ) là thứ
          đã sinh ra lời than "phải lướt lên lướt xuống".
        */}
        <div className="relative h-full w-full [perspective:1400px]">
          {outgoingPage && pageTransition ? (
            <div
              aria-hidden="true"
              data-page-transition={pageTransition.direction}
              data-transition-layer="outgoing"
              className={`pointer-events-none absolute inset-0 z-10 [transform-origin:center] [transform-style:preserve-3d] motion-reduce:hidden ${
                pageTransition.direction === "next"
                  ? "flashcard-page-out-next"
                  : "flashcard-page-out-previous"
              }`}
            >
              <FlashcardSurface
                page={outgoingPage}
                face={outgoingFace}
                className=""
                fill
              />
            </div>
          ) : null}

          <div
            key={page.id}
            data-page-transition={pageTransition?.direction}
            data-transition-layer="incoming"
            className={`relative h-full [transform-origin:center] [transform-style:preserve-3d] motion-reduce:animate-none ${
              pageTransition?.direction === "next"
                ? "flashcard-page-in-next"
                : pageTransition?.direction === "previous"
                  ? "flashcard-page-in-previous"
                  : ""
            }`}
            onAnimationEnd={(event) => {
              if (event.currentTarget === event.target) {
                setPageTransition(null);
              }
            }}
          >
            <FlashcardTapArea
              label={`Mặt ${face === "front" ? "trước" : "sau"} của ${
                page.kind === "session_cover" ? "trang mở đầu" : page.hanzi
              }. Nhấn Enter hoặc phím cách để lật mặt.`}
              disabled={Boolean(pageTransition)}
              onFlip={toggleFace}
              onNext={() => navigate(pageIndex + 1)}
              onPrevious={() => navigate(pageIndex - 1)}
            >
              <FlashcardSurface
                page={page}
                face={face}
                className=""
                durationClassName="duration-300"
                fill
              />
            </FlashcardTapArea>
          </div>
        </div>
      </FlashcardFrameStage>

      <FlashcardFrameControls maxWidthClassName={FRAME_WIDTH}>
        {page.audioUrl ? (
          <StudentAudioPlayer
            key={page.audioUrl}
            src={page.audioUrl}
            label={pageTitle}
            appearance="button"
            density="compact"
          />
        ) : page.audio_path ? (
          <Alert className="py-2">
            <Volume2 className="size-4" aria-hidden />
            <AlertDescription>Audio tạm thời không khả dụng.</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-full sm:size-14"
            disabled={pageIndex === 0 || Boolean(pageTransition)}
            onClick={() => navigate(pageIndex - 1)}
            aria-label="Trang flashcard trước"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Button>

          {/* CTA chính DUY NHẤT của khung — mũi tên và audio là phụ. */}
          <Button
            type="button"
            className="h-12 min-w-0 flex-1 gap-2 text-base sm:h-14"
            disabled={Boolean(pageTransition)}
            onClick={toggleFace}
          >
            <RotateCw className="size-5" aria-hidden />
            Lật thẻ
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-full sm:size-14"
            disabled={
              pageIndex === orderedPages.length - 1 || Boolean(pageTransition)
            }
            onClick={() => navigate(pageIndex + 1)}
            aria-label="Trang flashcard tiếp theo"
          >
            <ChevronRight className="size-6" aria-hidden />
          </Button>
        </div>
      </FlashcardFrameControls>
    </FlashcardReaderFrame>
  );
}
