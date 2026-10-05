import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { ListeningAudioPlayer } from "@/features/listening/components/listening-audio-player";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import {
  LISTENING_BOOK_PAGE_COUNT,
  LISTENING_PAGES,
  listeningPageHref,
  tracksForPage,
} from "@/features/listening/data";

type PageProps = { params: Promise<{ page: string }> };

function parsePageSlug(slug: string) {
  const match = /^trang-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  const page = Number(match[1]);
  return page >= 1 && page <= LISTENING_BOOK_PAGE_COUNT ? page : null;
}

export function generateStaticParams() {
  return LISTENING_PAGES.map((page) => ({ page: `trang-${page}` }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const page = parsePageSlug((await params).page);
  if (!page) return {};
  return {
    title: `Bài nghe trang ${page} – Bài 3`,
    description: `Audio luyện nghe cho trang ${page}, Bài 3 – Thời gian.`,
    robots: { index: false, follow: false },
  };
}

export default async function ListeningPage({ params }: PageProps) {
  const page = parsePageSlug((await params).page);
  if (!page) notFound();

  const tracks = tracksForPage(page);
  const pageIndex = LISTENING_PAGES.indexOf(page);
  const previousPage =
    pageIndex > 0 ? LISTENING_PAGES[pageIndex - 1] : undefined;
  const nextPage =
    pageIndex >= 0 && pageIndex < LISTENING_PAGES.length - 1
      ? LISTENING_PAGES[pageIndex + 1]
      : undefined;

  return (
    <ListeningShell>
      <section className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
        <Link
          href="/nghe"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1a5fa8] hover:text-[#134b86] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Về danh sách bài nghe
        </Link>

        <div className="mt-5 rounded-3xl bg-[#0d3f78] p-6 text-white shadow-lg sm:p-8">
          <p className="text-sm font-bold tracking-[0.14em] text-[#91bbe8] uppercase">
            Bài 3 · Thời gian
          </p>
          <h1 className="mt-2 text-3xl font-bold">Trang {page}</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Mở đúng trang {page} trong tài liệu và nghe theo thứ tự từ trên
            xuống.
          </p>
        </div>

        {tracks.length > 0 ? (
          <div className="mt-6 space-y-4">
            {tracks.map((track) => (
              <ListeningAudioPlayer key={track.src} track={track} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[#91bbe8] bg-white px-5 py-10 text-center">
            <BookOpen className="mx-auto size-10 text-[#1a5fa8]" aria-hidden />
            <h2 className="mt-4 text-xl font-bold text-[#0d3f78]">
              Trang này không có audio
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6b80]">
              Đây có thể là trang bài tập hoặc trang luyện viết trong tài liệu.
            </p>
            <Link
              href="/nghe"
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#1a5fa8] px-5 text-sm font-bold text-white transition hover:bg-[#134b86]"
            >
              Về trang bài nghe
            </Link>
          </div>
        )}

        {tracks.length > 0 && (
          <nav
            aria-label="Chuyển trang có audio"
            className="mt-8 grid grid-cols-2 gap-3"
          >
            {previousPage ? (
              <Link
                href={listeningPageHref(previousPage)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#c3dbf4] bg-white px-3 text-sm font-bold text-[#134b86] hover:bg-[#e6effa]"
              >
                <ChevronLeft className="size-4" aria-hidden /> Trang{" "}
                {previousPage}
              </Link>
            ) : (
              <span />
            )}
            {nextPage ? (
              <Link
                href={listeningPageHref(nextPage)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#c3dbf4] bg-white px-3 text-sm font-bold text-[#134b86] hover:bg-[#e6effa]"
              >
                Trang {nextPage} <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </ListeningShell>
  );
}
