"use client";

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
  FlashcardFaceContent,
  type Face,
} from "@/features/flashcards/components/flashcard-face";
import { setFlashcardStarAction } from "@/features/flashcards/server/actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";

/** Mỗi nhịp phát tự động: đủ để đọc một mặt thẻ rồi mới sang mặt/trang kế. */
const AUTOPLAY_STEP_MS = 4000;

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

      {/*
        Hàng điều khiển BUỔI (khác hàng điều khiển THẺ ở dưới thẻ): thứ tự và
        phát tự động. Cụm thứ tự đứng liền nhau vì chúng là hai chiều của cùng
        một việc; phát tự động tách sang phải cho khỏi lẫn.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={isShuffled ? "default" : "outline"}
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
            disabled={!isShuffled}
            onClick={restoreOriginalOrder}
          >
            <ListOrdered className="size-4" aria-hidden />
            Thứ tự gốc
          </Button>
        </div>
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
      </div>
      {isShuffled && (
        <p className="text-muted-foreground text-sm">
          Thứ tự xáo trộn chỉ áp cho buổi này và không được lưu — đăng nhập lại
          sẽ trở về thứ tự gốc.
        </p>
      )}

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

      {/*
        BẢNG ĐIỀU KHIỂN THẺ — dựng lại ở đợt này.
        Bản cũ đổ thẳng ba thứ vào một hàng `flex`: nút Lật mặt, nút Đánh dấu
        khó, và `StudentAudioPlayer` — mà bản thân trình phát lại là một khối
        `flex-wrap` chứa nút phát + chữ "Tốc độ" + ba nút tốc độ. Hệ quả đo
        được: khối trình phát tự xuống thành hai dòng trong khi hai nút bên
        cạnh vẫn một dòng, nên không có đường ngang nào chung — đúng cảm giác
        "so le, không thẳng hàng".

        Bản mới đặt ba luật cho cả vùng:
        (1) MỘT khung có viền gom cả nhận dạng trang lẫn nút, tách khỏi thẻ ở
            trên bằng đường kẻ — vùng điều khiển có ranh giới rõ ràng.
        (2) MỌI control cao đúng 40px (44px trên cảm ứng, do `globals.css`), kể
            cả khối tốc độ, nên tất cả nằm trên cùng một đường ngang.
        (3) Hai CỤM theo chức năng — "việc với thẻ" bên trái, "việc với tiếng"
            bên phải — ghim về hai mép bằng `justify-between`. Nhờ vậy khi nhãn
            trái dài ra ("Đánh dấu khó" → "Đã đánh dấu khó") thì nó nở vào
            khoảng trống giữa, cụm audio bên phải ĐỨNG YÊN.
      */}
      <div className="bg-card mx-auto max-w-3xl rounded-xl border shadow-sm">
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-2.5 text-sm"
        >
          <p className="flex min-w-0 items-baseline gap-x-2">
            <span className="font-hanzi truncate font-semibold">
              {page.kind === "session_cover" ? "Trang mở đầu" : page.hanzi}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              Trang {pageIndex + 1}/{orderedPages.length}
            </span>
          </p>
          <StatusBadge
            label={face === "front" ? "Mặt trước" : "Mặt sau"}
            tone="info"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          {page.audioUrl ? (
            <FlashcardAudioButton
              key={page.audioUrl}
              url={page.audioUrl}
              label={pageTitle}
              autoPlayToken={audioAutoPlayToken}
            />
          ) : page.audio_path ? (
            <Alert className="w-auto py-2">
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
        lật mặt. Phát tự động sẽ đọc audio mỗi khi sang mặt trước.
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

function FlashcardAudioButton({
  url,
  label,
  autoPlayToken,
}: {
  url: string;
  label: string;
  autoPlayToken: string | null;
}) {
  return (
    <StudentAudioPlayer
      src={url}
      label={label}
      appearance="button"
      autoPlayToken={autoPlayToken}
    />
  );
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
        {/* Ảnh trang mở đầu là LCP của màn học viên — giữ `priority`. */}
        <FlashcardFaceContent page={page} face="front" priority />
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
      // trước lẫn khối "Thẻ" của mặt sau.
      data-face-side={back ? "back" : "front"}
      className={`bg-card absolute inset-0 overflow-hidden rounded-2xl border shadow-lg [backface-visibility:hidden] ${
        back ? "[transform:rotateX(180deg)]" : ""
      }`}
    >
      {children}
    </div>
  );
}
