import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { ListeningAudioPlayer } from "@/features/listening/components/listening-audio-player";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import {
  PHAT_AM_ALL_PAGES,
  PHAT_AM_AUDIO_PAGES,
  PHAT_AM_BOOK_PAGE_COUNT,
  PHAT_AM_SLIDES,
  phatAmPageHref,
  tracksForPhatAmPage,
} from "@/features/listening/phat-am-data";

type PageProps = { params: Promise<{ page: string }> };

function parsePageSlug(slug: string) {
  const match = /^trang-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  const page = Number(match[1]);
  return page >= 1 && page <= PHAT_AM_BOOK_PAGE_COUNT ? page : null;
}

export function generateStaticParams() {
  return PHAT_AM_ALL_PAGES.map((page) => ({ page: `trang-${page}` }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const page = parsePageSlug((await params).page);
  if (!page) return {};
  const slide = PHAT_AM_SLIDES[page];
  return {
    title: `Bài phát âm trang ${page} – 汉语拼音`,
    description:
      slide?.description ?? `Tài liệu và audio luyện phát âm trang ${page}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PhatAmPage({ params }: PageProps) {
  const page = parsePageSlug((await params).page);
  if (!page) notFound();

  const tracks = tracksForPhatAmPage(page);
  const slide = PHAT_AM_SLIDES[page];
  const previousPage = page > 1 ? page - 1 : undefined;
  const nextPage = page < PHAT_AM_BOOK_PAGE_COUNT ? page + 1 : undefined;

  return (
    <ListeningShell lesson="Bài phát âm · 汉语拼音">
      <section className="mx-auto max-w-3xl px-3.5 py-5 sm:px-6 sm:py-10">
        <Link
          href="/nghe/phat-am"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-[#1a5fa8] hover:text-[#134b86] hover:underline sm:min-h-11 sm:gap-2 sm:text-sm"
        >
          <ArrowLeft className="size-3.5 sm:size-4" aria-hidden /> Về danh sách Bài phát âm
        </Link>

        <div className="mt-3.5 rounded-2xl bg-[#0d3f78] p-4 text-white shadow-lg sm:mt-5 sm:rounded-3xl sm:p-8">
          <p className="text-xs font-bold tracking-[0.14em] text-[#91bbe8] uppercase sm:text-sm">
            Bài phát âm · 汉语拼音
          </p>
          <h1 className="mt-1.5 text-xl font-bold sm:mt-2 sm:text-3xl">
            {slide?.title ?? `Trang ${page}`}
          </h1>
          {slide?.description ? (
            <p className="mt-2 text-xs leading-5 text-white/80 sm:mt-3 sm:text-sm sm:leading-6">
              {slide.description}
            </p>
          ) : null}
        </div>

        {tracks.length > 0 ? (
          <div className="mt-4 space-y-3.5 sm:mt-6 sm:space-y-4">
            {tracks.map((track) => (
              <ListeningAudioPlayer key={track.src} track={track} />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3.5 sm:mt-6 sm:space-y-4">
            <div className="rounded-2xl border border-dashed border-[#91bbe8] bg-[#f0f6fc] px-4 py-5 text-center sm:px-5 sm:py-6">
              <BookOpen className="mx-auto size-7 text-[#1a5fa8] sm:size-8" aria-hidden />
              <h2 className="mt-2 text-base font-bold text-[#0d3f78] sm:text-lg">
                Trang lý thuyết & quy tắc ngữ âm
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#5b6b80] sm:text-sm sm:leading-6">
                Trang này không có file audio riêng. Mời học viên đọc kỹ quy tắc
                trong tài liệu bên dưới.
              </p>
            </div>
            {slide?.image ? (
              <figure className="overflow-hidden rounded-xl border border-[#dde5ee] bg-[#f6f8fb]">
                <a
                  href={slide.image.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Nhấn để phóng to ảnh"
                  className="block cursor-zoom-in"
                >
                  <Image
                    src={slide.image.src}
                    width={slide.image.width}
                    height={slide.image.height}
                    sizes="(max-width: 768px) calc(100vw - 2.5rem), 44rem"
                    alt={`Tài liệu ${slide.title}`}
                    className="h-auto w-full transition hover:opacity-95"
                    priority
                  />
                </a>
                <figcaption className="flex items-center justify-between gap-2 border-t border-[#dde5ee] bg-white px-3 py-2 text-xs font-medium text-[#43536b] sm:text-sm">
                  <span className="truncate">{slide.title}</span>
                  <a
                    href={slide.image.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-semibold text-[#1a5fa8] hover:underline"
                  >
                    Phóng to ↗
                  </a>
                </figcaption>
              </figure>
            ) : null}
          </div>
        )}

        <nav
          aria-label="Chuyển trang slide"
          className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3"
        >
          {previousPage ? (
            <Link
              href={phatAmPageHref(previousPage)}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-[#c3dbf4] bg-white px-3 text-xs font-bold text-[#134b86] transition hover:bg-[#e6effa] sm:gap-2 sm:text-sm"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden /> Trang {previousPage}
            </Link>
          ) : (
            <span />
          )}
          {nextPage ? (
            <Link
              href={phatAmPageHref(nextPage)}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-[#c3dbf4] bg-white px-3 text-xs font-bold text-[#134b86] transition hover:bg-[#e6effa] sm:gap-2 sm:text-sm"
            >
              Trang {nextPage} <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <nav
          aria-label="Chuyển nhanh giữa các slide"
          className="mt-4 rounded-2xl border border-[#dde5ee] bg-white p-3 sm:mt-6 sm:p-4"
        >
          <div className="mb-2 flex items-center justify-between text-xs text-[#5b6b80]">
            <span className="font-semibold text-[#10243f]">Tất cả slide ({PHAT_AM_BOOK_PAGE_COUNT})</span>
            <span>Trang {page}/{PHAT_AM_BOOK_PAGE_COUNT}</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 sm:flex-wrap">
            {PHAT_AM_ALL_PAGES.map((p) => {
              const isCurrent = p === page;
              const hasAudio = PHAT_AM_AUDIO_PAGES.includes(p);
              return (
                <Link
                  key={p}
                  href={phatAmPageHref(p)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-bold transition ${
                    isCurrent
                      ? "bg-[#1a5fa8] text-white shadow-sm"
                      : hasAudio
                        ? "border border-[#c3dbf4] bg-[#f0f6fc] text-[#0d3f78] hover:bg-[#e0edf9]"
                        : "border border-[#dde5ee] bg-white text-[#5b6b80] hover:bg-[#f6f8fb]"
                  }`}
                  title={`Trang ${p}${hasAudio ? " (Có audio)" : " (Lý thuyết)"}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        </nav>
      </section>
    </ListeningShell>
  );
}
