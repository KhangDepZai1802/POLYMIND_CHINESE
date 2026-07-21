"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Pause,
  RotateCw,
  Volume2,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";

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
}: {
  deck: FlashcardDeckView | null;
  courseName: string | null;
}) {
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
  const touchStartX = useRef<number | null>(null);
  const suppressFlip = useRef(false);

  const section =
    sections.find((candidate) => candidate.id === sectionId) ??
    sections[0] ??
    null;
  const rawPageIndex = section ? (pageBySection[section.id] ?? 0) : 0;
  const pageIndex = section
    ? Math.min(rawPageIndex, Math.max(section.pages.length - 1, 0))
    : 0;
  const page = section?.pages[pageIndex] ?? null;
  const face = page ? (faceByPage[page.id] ?? "front") : "front";
  const outgoingPage =
    section && pageTransition?.sectionId === section.id
      ? (section.pages[pageTransition.fromIndex] ?? null)
      : null;
  const outgoingFace = pageTransition?.fromFace ?? "front";

  useEffect(() => {
    if (!pageTransition) return;

    const fallbackTimer = window.setTimeout(() => {
      setPageTransition(null);
    }, 520);

    return () => window.clearTimeout(fallbackTimer);
  }, [pageTransition]);

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

  // Tiêu đề admin đặt cho trang: từ/cụm từ với trang từ vựng, tên buổi với trang mở đầu.
  const pageTitle =
    page.kind === "vocabulary" ? (page.term ?? section.title) : section.title;

  function navigate(nextIndex: number) {
    if (
      !section ||
      pageTransition ||
      nextIndex < 0 ||
      nextIndex >= section.pages.length
    ) {
      return;
    }
    const leavingPage = section.pages[pageIndex];
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
              setSectionId(candidate.id);
            }}
          >
            Buổi {candidate.session_number}
          </Button>
        ))}
      </nav>

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
                page.kind === "session_cover" ? "trang mở đầu" : page.term
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
            pageIndex === section.pages.length - 1 || Boolean(pageTransition)
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
            {page.kind === "session_cover" ? "Trang mở đầu" : page.term}
          </span>
          <span className="text-muted-foreground">
            {` · Trang ${pageIndex + 1}/${section.pages.length} · ${
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
      <FlashcardFaces page={page} face={face} />
    </div>
  );
}

function FlashcardAudioButton({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <Button
        type="button"
        aria-label={playing ? `Dừng audio ${label}` : `Phát audio ${label}`}
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (audio.paused) {
            audio.currentTime = 0;
            void audio.play().catch(() => setPlaying(false));
          } else {
            audio.pause();
          }
        }}
      >
        {playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
        <span className="font-hanzi max-w-40 truncate">{label}</span>
      </Button>
      <audio
        key={url}
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}

function FlashcardFaces({
  page,
  face,
}: {
  page: FlashcardPage;
  face: Face;
}) {
  return (
    <div
      data-face={face}
      className="absolute inset-0 origin-center transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
      style={{
        transform: `rotateX(${face === "back" ? 180 : 0}deg)`,
      }}
    >
      <FlashcardFace
        url={page.frontUrl}
        alt={page.front_alt}
        label="Mặt trước"
      />
      <FlashcardFace
        url={page.backUrl}
        alt={page.back_alt}
        label="Mặt sau"
        back
      />
    </div>
  );
}

function FlashcardFace({
  url,
  alt,
  label,
  back = false,
}: {
  url: string | null;
  alt: string;
  label: string;
  back?: boolean;
}) {
  return (
    <div
      className={`bg-card absolute inset-0 overflow-hidden rounded-2xl border shadow-lg [backface-visibility:hidden] ${
        back ? "[transform:rotateX(180deg)]" : ""
      }`}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes="(max-width: 768px) 80vw, 680px"
          unoptimized
          // Mobile giữ nguyên khung đầy; desktop thu gọn để thấy trọn ảnh.
          className="object-cover sm:object-contain"
          priority={!back}
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-full items-center justify-center p-6 text-center">
          Không tải được ảnh {label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}
