"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Maximize2,
  Pause,
  Play,
  RotateCw,
  Shuffle,
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
import { type Face } from "@/features/flashcards/components/flashcard-face";
import {
  FlashcardFrameControls,
  FlashcardFrameHeader,
  FlashcardFrameStage,
  FlashcardReaderFrame,
  FlashcardTapArea,
} from "@/features/flashcards/components/flashcard-reader-frame";
import {
  FlashcardFaces,
  FlashcardSizer,
  FlashcardSurface,
} from "@/features/flashcards/components/flashcard-surface";
import { setFlashcardStarAction } from "@/features/flashcards/server/actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";

/** Mỗi nhịp phát tự động: đủ để đọc một mặt thẻ rồi mới sang mặt/trang kế. */
const AUTOPLAY_STEP_MS = 4000;

/**
 * Bề rộng tối đa của vùng thẻ.
 *
 * Rộng hơn `max-w-xl` của trang công khai vì màn này còn được xem trên laptop —
 * nhưng vẫn có trần: dòng chữ dài quá 75 ký tự là khó đọc (`line-length`).
 */
const FRAME_WIDTH = "max-w-xl sm:max-w-2xl";

type PageDirection = "next" | "previous";
type FlashcardPage = FlashcardDeckView["sections"][number]["pages"][number];
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
}: {
  deck: FlashcardDeckView | null;
  courseName: string | null;
  starredPageIds?: string[];
}) {
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
  const [autoPlaying, setAutoPlaying] = useState(false);
  /**
   * Toàn màn hình là MẶC ĐỊNH (user chốt 2026-07-25 sau khi so hai phương án).
   *
   * Lý do không đợi `matchMedia` rồi mới quyết: khung dựng bằng `fixed inset-0`
   * nên nó che vỏ dashboard ngay từ lần vẽ ĐẦU TIÊN, kể cả HTML từ máy chủ. Nếu
   * để trạng thái ban đầu phụ thuộc bề rộng đo được ở client thì lần vẽ đầu là
   * `inline`, lần thứ hai mới thành `fullscreen` — người dùng thấy trang nhảy.
   *
   * Thoát toàn màn hình KHÔNG dẫn tới trạng thái chết: khung chuyển sang
   * `inline`, vẫn đủ mọi nút để học tiếp, và nút ⛶ đưa trở lại.
   */
  const [fullscreen, setFullscreen] = useState(true);

  const section =
    sections.find((candidate) => candidate.id === sectionId) ??
    sections[0] ??
    null;

  /**
   * Thứ tự sau khi xáo trộn, GIỮ TRONG STATE REACT.
   *
   * Cố ý không dùng `sessionStorage`: `sessionStorage` sống qua đăng xuất rồi
   * đăng nhập lại trong cùng một tab, tức vi phạm đúng điều `Q6` yêu cầu
   * ("đăng nhập lại thì trở về thứ tự gốc"). `localStorage` và DB thì đã bị cấm
   * thẳng. State React mất khi rời trang nên là chỗ duy nhất thoả cả ba.
   */
  const [shuffleBySection, setShuffleBySection] = useState<
    Record<string, string[]>
  >({});

  const orderedPages = useMemo(() => {
    if (!section) return [];
    const order = shuffleBySection[section.id];
    if (!order) return section.pages;
    const remaining = new Map(section.pages.map((item) => [item.id, item]));
    const shuffled = order
      .map((id) => remaining.get(id))
      .filter((item): item is FlashcardPage => Boolean(item));
    for (const item of shuffled) remaining.delete(item.id);
    // Trang xuất hiện sau lúc xáo trộn thì nối vào cuối, không biến mất.
    return [...shuffled, ...remaining.values()];
  }, [section, shuffleBySection]);

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
  const isShuffled = Boolean(section && shuffleBySection[section.id]);

  /**
   * Khung dựng ra được hay không — tính TRƯỚC các nhánh `return` rỗng bên dưới
   * để hiệu ứng toàn màn hình không bị gọi có điều kiện (luật của hooks).
   */
  const hasFrame = Boolean(courseName && deck && section && page);

  /**
   * Cờ trên `<html>` cho `globals.css` ẩn chrome + khoá cuộn nền.
   *
   * Dọn ở hàm cleanup nên MỌI đường ra đều trả chrome về: thoát toàn màn hình,
   * đổi sang tab "Ôn Tập Câu Sai" (Radix unmount nội dung tab cũ), hay rời trang.
   * Không dọn ⇒ học viên bấm sang tab khác và thấy một trang không có header,
   * không cuộn được — lỗi im lặng không có đường thoát.
   */
  useEffect(() => {
    if (!fullscreen || !hasFrame) return;
    const root = document.documentElement;
    root.dataset.flashcardFocus = "true";
    return () => {
      delete root.dataset.flashcardFocus;
    };
  }, [fullscreen, hasFrame]);

  useEffect(() => {
    if (!pageTransition) return;

    const fallbackTimer = window.setTimeout(() => {
      setPageTransition(null);
    }, 520);

    return () => window.clearTimeout(fallbackTimer);
  }, [pageTransition]);

  // `navigate` được khai báo bên dưới (function declaration nên đã hoisted).
  // Giữ qua ref để hiệu ứng phát tự động không phải nhận nó làm dependency.
  const navigateRef = useRef<(index: number) => void>(() => {});
  useEffect(() => {
    navigateRef.current = navigate;
  });

  // Phát tự động: mặt trước → mặt sau → trang kế. LUÔN do người dùng bấm mới
  // chạy và luôn dừng được (WCAG 2.2.2). Hoạt ảnh lật/trượt đã bị chặn sẵn bởi
  // các lớp `motion-reduce:` nên chế độ giảm chuyển động vẫn dùng được nút này.
  useEffect(() => {
    if (!autoPlaying || !page) return;

    const timer = window.setTimeout(() => {
      const currentFace = faceByPage[page.id] ?? "front";
      if (currentFace === "front") {
        setFaceByPage((current) => ({ ...current, [page.id]: "back" }));
        return;
      }
      const next = pageIndex + 1;
      if (next >= orderedPages.length) {
        setAutoPlaying(false);
        return;
      }
      navigateRef.current(next);
    }, AUTOPLAY_STEP_MS);

    return () => window.clearTimeout(timer);
  }, [autoPlaying, page, pageIndex, faceByPage, orderedPages.length]);

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

  /**
   * Mốc phát audio cho `StudentAudioPlayer`.
   *
   * Đang phát tự động + đang ở MẶT TRƯỚC ⇒ mốc mang mã trang, trình phát đọc
   * lại từ đầu. Lật sang mặt sau, sang trang khác, hoặc tắt phát tự động ⇒ mốc
   * về `null`, trình phát im ngay (WCAG 2.2.2: tiếng tự chạy phải dừng được).
   * Mốc kèm mã trang nên hai trang liền nhau không bị coi là "không đổi".
   */
  const audioAutoPlayToken =
    autoPlaying && face === "front" ? `${page.id}:front` : null;

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
   * Xáo trộn CHỈ buổi đang chọn (`Q6`). Trang mở đầu giữ nguyên vị trí đầu —
   * nó là lời mở buổi, không phải một thẻ để học ngẫu nhiên.
   */
  function shuffleCurrentSection() {
    if (!section) return;
    const cover = section.pages.filter(
      (item) => item.kind === "session_cover",
    );
    const rest = section.pages.filter((item) => item.kind !== "session_cover");
    for (let index = rest.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [rest[index], rest[swap]] = [rest[swap]!, rest[index]!];
    }
    setPageTransition(null);
    setShuffleBySection((current) => ({
      ...current,
      [section.id]: [...cover, ...rest].map((item) => item.id),
    }));
    setPageBySection((current) => ({ ...current, [section.id]: 0 }));
  }

  function restoreOriginalOrder() {
    if (!section) return;
    setPageTransition(null);
    setShuffleBySection((current) => {
      const next = { ...current };
      delete next[section.id];
      return next;
    });
    setPageBySection((current) => ({ ...current, [section.id]: 0 }));
  }

  return (
    <FlashcardReaderFrame
      mode={fullscreen ? "fullscreen" : "inline"}
      /*
       * Phím mũi tên nghe Ở KHUNG, không ở `window`.
       *
       * Khung này chỉ là một vùng trong trang Ôn tập (khác trang công khai, nơi
       * khung là cả trang). Nghe ở `window` sẽ cướp phím mũi tên của việc cuộn
       * trang khi khung đang ở dạng `inline`.
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
            aria-label={
              fullscreen ? "Thoát toàn màn hình" : "Ôn thẻ toàn màn hình"
            }
            title={fullscreen ? "Thoát toàn màn hình" : "Ôn thẻ toàn màn hình"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Maximize2 className="size-5" aria-hidden />
            )}
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

          Chỉ dựng khi có TỪ HAI BUỔI trở lên. Một buổi thì hàng nút này không
          chọn được gì khác — mà trong khung một-màn-hình nó lấy 48px chiều cao
          của chính cái thẻ. Hôm nay khoá `VCB-BANK` mới công bố đúng một buổi,
          nên đây là ca thật chứ không phải giả định.
        */}
        {sections.length > 1 && (
          <nav
            aria-label="Mục lục buổi flashcard"
            className="mt-2 flex gap-2 overflow-x-auto pb-1"
          >
            {sections.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                variant={candidate.id === section.id ? "default" : "outline"}
                className="h-11 shrink-0"
                onClick={() => {
                  setPageTransition(null);
                  setAutoPlaying(false);
                  setSectionId(candidate.id);
                }}
              >
                Buổi {candidate.session_number}
              </Button>
            ))}
          </nav>
        )}

        {/*
          Hàng điều khiển BUỔI: thứ tự và phát tự động.

          `flex-wrap` là cố ý. Ba nút này cần ~374px nên trên điện thoại chúng
          xuống hai hàng — và đó là lựa chọn ĐÚNG: thà thêm một hàng trong khung
          còn hơn cắt mất nút như `BUG-P17-002`, hoặc bắt người dùng cuộn ngang
          để tìm nút "Phát tự động".
        */}
        <div className="mt-2 flex flex-wrap items-center gap-2 pb-1">
          <Button
            type="button"
            variant={isShuffled ? "default" : "outline"}
            className="h-11"
            onClick={shuffleCurrentSection}
          >
            <Shuffle className="size-4" aria-hidden />
            {isShuffled ? "Xáo trộn lại" : "Xáo trộn"}
          </Button>
          {/*
            Luôn hiện, và mờ đi khi chưa xáo trộn — thay vì chỉ xuất hiện sau
            khi bấm Xáo trộn. Người dùng thấy trước rằng việc xáo trộn có đường
            lùi, nên dám thử; và hàng nút không đổi số lượng giữa chừng.
          */}
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={!isShuffled}
            onClick={restoreOriginalOrder}
          >
            <ListOrdered className="size-4" aria-hidden />
            Thứ tự gốc
          </Button>
          <Button
            type="button"
            variant={autoPlaying ? "default" : "outline"}
            className="h-11"
            aria-pressed={autoPlaying}
            onClick={() => setAutoPlaying((playing) => !playing)}
          >
            {autoPlaying ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            {autoPlaying ? "Dừng phát" : "Phát tự động"}
          </Button>
        </div>

        {isShuffled && (
          // Câu này đã rút ngắn: trong khung một-màn-hình thì mỗi dòng chữ đều
          // lấy chỗ của thẻ. Vế "không lưu lại" là vế phải giữ (chốt `Q6`).
          <p className="text-muted-foreground pb-1 text-xs">
            Thứ tự xáo trộn chỉ áp cho buổi này, không lưu lại.
          </p>
        )}
      </FlashcardFrameHeader>

      <FlashcardFrameStage maxWidthClassName={FRAME_WIDTH}>
        <div className="relative w-full [perspective:1400px]">
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
              <FlashcardSurface page={outgoingPage} face={outgoingFace} />
            </div>
          ) : null}

          <div
            key={page.id}
            data-page-transition={pageTransition?.direction}
            data-transition-layer="incoming"
            className={`relative [transform-origin:center] [transform-style:preserve-3d] motion-reduce:animate-none ${
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
              <FlashcardSizer page={page} />
              <FlashcardFaces
                page={page}
                face={face}
                durationClassName="duration-300"
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
            autoPlayToken={audioAutoPlayToken}
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
