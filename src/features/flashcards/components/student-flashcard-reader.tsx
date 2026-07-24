"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Pause,
  Play,
  RotateCw,
  Shuffle,
  Star,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentAudioPlayer } from "@/components/shared/student-audio-player";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  alignPinyinToHanzi,
  joinPinyin,
} from "@/features/flashcards/domain/pinyin";
import { readFlashcardSublists } from "@/features/flashcards/domain/sublists";
import { setFlashcardStarAction } from "@/features/flashcards/server/actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";

/** Mỗi nhịp phát tự động: đủ để đọc một mặt thẻ rồi mới sang mặt/trang kế. */
const AUTOPLAY_STEP_MS = 4000;

type Face = "front" | "back";
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
  const touchStartX = useRef<number | null>(null);
  const suppressFlip = useRef(false);

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

  function handleCardClick() {
    if (suppressFlip.current) {
      suppressFlip.current = false;
      return;
    }
    toggleFace();
  }

  return (
    <div
      className="space-y-4"
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{deck.title}</h2>
          <p className="text-muted-foreground text-sm">{courseName}</p>
        </div>
        <StatusBadge label={`${sections.length} buổi đã mở`} tone="success" />
      </div>

      <nav
        aria-label="Mục lục buổi flashcard"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {sections.map((candidate) => (
          <Button
            key={candidate.id}
            type="button"
            variant={candidate.id === section.id ? "default" : "outline"}
            className="h-11 shrink-0 rounded-t-lg rounded-b-sm"
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isShuffled ? "default" : "outline"}
          onClick={shuffleCurrentSection}
        >
          <Shuffle className="size-4" aria-hidden />
          {isShuffled ? "Xáo trộn lại" : "Xáo trộn"}
        </Button>
        {isShuffled && (
          <Button type="button" variant="outline" onClick={restoreOriginalOrder}>
            <ListOrdered className="size-4" aria-hidden />
            Thứ tự gốc
          </Button>
        )}
        <Button
          type="button"
          variant={autoPlaying ? "default" : "outline"}
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
        {isShuffled && (
          <p className="text-muted-foreground text-sm">
            Thứ tự xáo trộn chỉ áp cho buổi này và không được lưu — đăng nhập
            lại sẽ trở về thứ tự gốc.
          </p>
        )}
      </div>

      <div className="relative mx-auto max-w-3xl px-12 sm:px-16">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-1/2 left-0 z-20 size-11 -translate-y-1/2 rounded-full"
          disabled={pageIndex === 0 || Boolean(pageTransition)}
          onClick={() => navigate(pageIndex - 1)}
          aria-label="Trang flashcard trước"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>

        <div className="relative [perspective:1400px]">
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
            <div
              role="button"
              tabIndex={pageTransition ? -1 : 0}
              aria-disabled={pageTransition ? true : undefined}
              aria-label={`Mặt ${face === "front" ? "trước" : "sau"} của ${
                page.kind === "session_cover" ? "trang mở đầu" : page.hanzi
              }. Nhấn Enter hoặc phím cách để lật mặt.`}
              className={`focus-visible:ring-ring relative min-h-[360px] rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-[560px] ${
                pageTransition ? "cursor-default" : "cursor-pointer"
              }`}
              onClick={handleCardClick}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleFace();
                }
              }}
              onTouchStart={(event) => {
                touchStartX.current = event.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const start = touchStartX.current;
                const end = event.changedTouches[0]?.clientX;
                touchStartX.current = null;
                if (
                  start === null ||
                  end === undefined ||
                  Math.abs(end - start) < 50
                ) {
                  return;
                }
                suppressFlip.current = true;
                navigate(end < start ? pageIndex + 1 : pageIndex - 1);
              }}
            >
              <FlashcardSizer page={page} />
              <FlashcardFaces page={page} face={face} />
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-1/2 right-0 z-20 size-11 -translate-y-1/2 rounded-full"
          disabled={
            pageIndex === orderedPages.length - 1 || Boolean(pageTransition)
          }
          onClick={() => navigate(pageIndex + 1)}
          aria-label="Trang flashcard tiếp theo"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm">
          <span className="font-medium">
            {page.kind === "session_cover" ? "Trang mở đầu" : page.hanzi}
          </span>
          <span className="text-muted-foreground">
            {` · Trang ${pageIndex + 1}/${orderedPages.length} · ${
              face === "front" ? "Mặt trước" : "Mặt sau"
            }`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(pageTransition)}
            onClick={toggleFace}
          >
            <RotateCw className="size-4" aria-hidden />
            Lật mặt
          </Button>
          {page.kind === "vocabulary" && (
            <Button
              type="button"
              variant={starred.has(page.id) ? "default" : "outline"}
              disabled={starPending}
              aria-pressed={starred.has(page.id)}
              onClick={() => setStar(page.id, !starred.has(page.id))}
            >
              <Star
                className={`size-4 ${starred.has(page.id) ? "fill-current" : ""}`}
                aria-hidden
              />
              {starred.has(page.id) ? "Đã đánh dấu khó" : "Đánh dấu khó"}
            </Button>
          )}
          {page.audioUrl ? (
            <FlashcardAudioButton
              key={page.audioUrl}
              url={page.audioUrl}
              label={pageTitle}
            />
          ) : page.audio_path ? (
            <Alert className="py-2">
              <Volume2 className="size-4" aria-hidden />
              <AlertDescription>
                Audio tạm thời không khả dụng.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        Vuốt hoặc dùng ← → để chuyển trang. Chạm thẻ, Enter hoặc phím cách để
        lật mặt.
      </p>
    </div>
  );
}

function FlashcardSurface({ page, face }: { page: FlashcardPage; face: Face }) {
  return (
    <div className="relative min-h-[360px] rounded-2xl sm:min-h-[560px]">
      <FlashcardSizer page={page} />
      <FlashcardFaces page={page} face={face} />
    </div>
  );
}

function FlashcardAudioButton({ url, label }: { url: string; label: string }) {
  return <StudentAudioPlayer src={url} label={label} appearance="button" />;
}

/**
 * Chiều cao THẬT của thẻ.
 *
 * Hai mặt đều `absolute inset-0` (bắt buộc, để lật 3D được), nên tự chúng không
 * đẩy được chiều cao nào. Trước Phase 16 thẻ là ẢNH nên một `min-height` cố định
 * là đủ; nay mặt sau là CHỮ và dài ngắn tuỳ thẻ. Khối này dựng cả hai mặt trong
 * CÙNG một ô grid, để trong luồng nhưng ẩn đi — ô grid vì thế cao bằng mặt cao
 * hơn, và thẻ luôn vừa đủ chứa chữ.
 *
 * Đây chính là chỗ sửa lời than gốc: chữ TỰ XUỐNG DÒNG và thẻ nở theo, thay vì
 * `object-cover` cắt cụt nội dung.
 */
function FlashcardSizer({ page }: { page: FlashcardPage }) {
  return (
    <div aria-hidden className="pointer-events-none invisible grid">
      {/*
        `border` để box-model KHỚP với `FlashcardFaceShell` (shell có viền 1px).
        Thiếu nó thì ô sizer cao hơn shell đúng 2px viền → mặt sau tràn 1–2px và
        bài "chữ không bị cắt" đỏ vì làm tròn.
      */}
      <div className="col-start-1 row-start-1 rounded-2xl border">
        <FlashcardFaceContent page={page} face="front" />
      </div>
      <div className="col-start-1 row-start-1 rounded-2xl border">
        <FlashcardFaceContent page={page} face="back" />
      </div>
    </div>
  );
}

function FlashcardFaces({ page, face }: { page: FlashcardPage; face: Face }) {
  return (
    <div
      data-face={face}
      className="absolute inset-0 origin-center transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
      style={{
        transform: `rotateX(${face === "back" ? 180 : 0}deg)`,
      }}
    >
      <FlashcardFaceShell>
        <FlashcardFaceContent page={page} face="front" />
      </FlashcardFaceShell>
      <FlashcardFaceShell back>
        <FlashcardFaceContent page={page} face="back" />
      </FlashcardFaceShell>
    </div>
  );
}

function FlashcardFaceShell({
  children,
  back = false,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div
      // Mốc để bài kiểm soi đúng MỘT mặt: cùng một chữ Hán có mặt ở cả mặt
      // trước lẫn khối "Tách nghĩa" của mặt sau.
      data-face-side={back ? "back" : "front"}
      className={`bg-card absolute inset-0 overflow-hidden rounded-2xl border shadow-lg [backface-visibility:hidden] ${
        back ? "[transform:rotateX(180deg)]" : ""
      }`}
    >
      {children}
    </div>
  );
}

function FlashcardFaceContent({
  page,
  face,
}: {
  page: FlashcardPage;
  face: Face;
}) {
  // Trang mở đầu giữ nguyên mô hình hai ảnh (chốt `Q5`) — không đổi một chút nào.
  if (page.kind === "session_cover") {
    return (
      <FlashcardImageFace
        url={face === "front" ? page.frontUrl : page.backUrl}
        alt={face === "front" ? page.front_alt : page.back_alt}
        label={face === "front" ? "Mặt trước" : "Mặt sau"}
        priority={face === "front"}
      />
    );
  }
  return face === "front" ? (
    <VocabularyFront page={page} />
  ) : (
    <VocabularyBack page={page} />
  );
}

function FlashcardImageFace({
  url,
  alt,
  label,
  priority,
}: {
  url: string | null;
  alt: string | null;
  label: string;
  priority: boolean;
}) {
  return (
    <div className="relative h-full min-h-[360px] w-full sm:min-h-[560px]">
      {url ? (
        <Image
          src={url}
          alt={alt ?? ""}
          fill
          sizes="(max-width: 768px) 80vw, 680px"
          unoptimized
          // Mobile giữ nguyên khung đầy; desktop thu gọn để thấy trọn ảnh.
          className="object-cover sm:object-contain"
          priority={priority}
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-full items-center justify-center p-6 text-center">
          Không tải được ảnh {label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

/**
 * Mặt trước §7ter: pinyin căn thẳng TRÊN TỪNG chữ Hán, Hán tự cỡ lớn nhất,
 * nghĩa tiếng Việt màu cam, ảnh minh hoạ tuỳ chọn.
 */
function VocabularyFront({ page }: { page: FlashcardPage }) {
  const hanzi = page.hanzi ?? "";
  const pinyin = page.pinyin_syllables ?? "";
  const alignment = alignPinyinToHanzi(hanzi, pinyin);
  const imageUrl = page.frontUrl;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 p-6 text-center sm:min-h-[560px] sm:p-8">
      {alignment ? (
        <p className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4">
          {alignment.map((cell, index) => (
            <span
              key={`${cell.hanzi}-${index}`}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-muted-foreground text-lg leading-none sm:text-xl">
                {cell.pinyin}
              </span>
              <span className="text-5xl leading-none font-bold sm:text-7xl">
                {cell.hanzi}
              </span>
            </span>
          ))}
        </p>
      ) : (
        // Số âm tiết không khớp số chữ Hán: hiện pinyin nguyên dòng thay vì căn
        // lệch. Sai lệch nhìn thấy được tốt hơn sai lệch im lặng.
        <>
          <p className="text-muted-foreground text-lg break-words sm:text-xl">
            {pinyin}
          </p>
          <p className="text-5xl leading-tight font-bold break-words sm:text-7xl">
            {hanzi}
          </p>
        </>
      )}

      <p className="text-student-amber-ink text-2xl font-semibold break-words sm:text-3xl">
        {page.meaning_vi}
      </p>

      {imageUrl && (
        <Image
          src={imageUrl}
          alt={page.front_alt ?? ""}
          width={320}
          height={220}
          unoptimized
          className="h-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
        />
      )}
    </div>
  );
}

type BackBlockTone = "neutral" | "cyan" | "sky" | "coral" | "amber";

const BACK_BLOCK_TONE: Record<BackBlockTone, string> = {
  neutral: "bg-muted border-border",
  cyan: "bg-student-cyan-surface border-student-cyan-border",
  sky: "bg-student-sky-surface border-student-sky-border",
  coral: "bg-student-coral-surface border-student-coral-border",
  amber: "bg-student-amber-surface border-student-amber-border",
};

function BackBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: BackBlockTone;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border-2 p-3 ${BACK_BLOCK_TONE[tone]}`}>
      <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Một dòng của ba danh sách con: Hán tự · pinyin · nghĩa. */
function SublistLine({
  hanzi,
  pinyin,
  meaningVi,
}: {
  hanzi: string;
  pinyin: string;
  meaningVi: string;
}) {
  return (
    <>
      <p className="text-lg font-semibold break-words">{hanzi}</p>
      <p className="text-muted-foreground text-sm break-words">{pinyin}</p>
      <p className="text-sm break-words">{meaningVi}</p>
    </>
  );
}

/** Mặt sau §7ter: 5 khối, mỗi khối một màu viền. */
function VocabularyBack({ page }: { page: FlashcardPage }) {
  const { senses, examples, phrases } = readFlashcardSublists(page);
  const hanzi = page.hanzi ?? "";
  // Mặt sau dùng pinyin VIẾT LIỀN — dẫn xuất từ dạng tách, không phải cột riêng.
  const joined = joinPinyin(page.pinyin_syllables ?? "");
  const backImageUrl = page.backUrl;

  return (
    <div className="flex min-h-[360px] flex-col gap-3 p-4 sm:min-h-[560px] sm:p-6">
      {/* Khối 1 — đầu thẻ */}
      <BackBlock title="Thẻ" tone="neutral">
        <p className="text-2xl font-bold break-words sm:text-3xl">
          {hanzi}
          {joined ? (
            <span className="text-muted-foreground font-normal">
              {" — "}
              {joined}
            </span>
          ) : null}
        </p>
      </BackBlock>

      {/* Khối 2 — nghĩa */}
      <BackBlock title="Nghĩa" tone="cyan">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-lg font-semibold break-words">
            {page.meaning_vi}
          </p>
          {backImageUrl && (
            <Image
              src={backImageUrl}
              alt={page.back_alt ?? ""}
              width={120}
              height={90}
              unoptimized
              className="h-auto max-h-24 w-auto rounded-lg object-contain"
            />
          )}
        </div>
      </BackBlock>

      {/* Khối 3 — tách nghĩa */}
      {senses.length > 0 && (
        <BackBlock title="Tách nghĩa" tone="sky">
          <ul className="space-y-2">
            {senses.map((item, index) => (
              <li key={`${item.hanzi}-${index}`}>
                <p className="break-words">
                  <span className="font-semibold">{item.hanzi}</span>
                  <span className="text-muted-foreground"> ({item.pinyin})</span>
                  <span>: {item.meaning_vi}</span>
                </p>
              </li>
            ))}
          </ul>
        </BackBlock>
      )}

      {/* Khối 4 — câu ví dụ */}
      {examples.length > 0 && (
        <BackBlock title="Câu ví dụ" tone="coral">
          <ul className="space-y-3">
            {examples.map((item, index) => {
              const url = item.image_path
                ? page.mediaUrls[item.image_path]
                : null;
              return (
                <li
                  key={`${item.hanzi}-${index}`}
                  className="flex flex-wrap items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <SublistLine
                      hanzi={item.hanzi}
                      pinyin={item.pinyin}
                      meaningVi={item.meaning_vi}
                    />
                  </div>
                  {url && (
                    <Image
                      src={url}
                      alt={`Ảnh minh hoạ câu ví dụ ${index + 1} của ${hanzi}`}
                      width={110}
                      height={80}
                      unoptimized
                      className="h-auto max-h-20 w-auto rounded-lg object-contain"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </BackBlock>
      )}

      {/* Khối 5 — cụm từ thường dùng */}
      {phrases.length > 0 && (
        <BackBlock title="Cụm từ thường dùng" tone="amber">
          <ul className="space-y-2">
            {phrases.map((item, index) => (
              <li key={`${item.hanzi}-${index}`} className="break-words">
                <span className="font-semibold">{item.hanzi}</span>
                <span className="text-muted-foreground"> — {item.pinyin}</span>
                <span> — {item.meaning_vi}</span>
              </li>
            ))}
          </ul>
        </BackBlock>
      )}
    </div>
  );
}
