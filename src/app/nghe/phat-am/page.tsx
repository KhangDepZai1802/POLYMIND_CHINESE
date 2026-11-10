import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Headphones } from "lucide-react";

import { ListeningShell } from "@/features/listening/components/listening-shell";
import {
  PHAT_AM_ALL_PAGES,
  PHAT_AM_AUDIO_PAGES,
  PHAT_AM_SLIDES,
  PHAT_AM_TRACKS,
  phatAmPageHref,
} from "@/features/listening/phat-am-data";

export const metadata: Metadata = {
  title: "Bài phát âm – 汉语拼音",
  description:
    "Bộ audio và tài liệu luyện phát âm tiếng Trung (Hán ngữ Pinyin) dành cho học viên Học viện lãnh đạo.",
  robots: { index: false, follow: false },
};

export default function PhatAmIndexPage() {
  return (
    <ListeningShell lesson="Bài phát âm · 汉语拼音">
      <section className="bg-[#0d3f78] px-4 py-8 text-white sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold tracking-[0.14em] text-[#91bbe8] uppercase sm:text-sm">
            Vietcombank · Học viện lãnh đạo
          </p>
          <h1 className="mt-2 text-2xl leading-tight font-bold sm:mt-3 sm:text-4xl">
            Bài phát âm – 汉语拼音
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 sm:mt-4 sm:text-base sm:leading-7">
            Luyện ngữ âm Hán ngữ căn bản: cấu trúc âm tiết, 4 thanh điệu, quy tắc
            thanh nhẹ, biến điệu và các bảng ghép âm thực hành.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-3.5 py-6 sm:px-6 sm:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-5">
          <div className="flex items-center gap-2">
            <Headphones className="size-4 text-[#1a5fa8] sm:size-5" aria-hidden />
            <h2 className="text-lg font-bold text-[#10243f] sm:text-xl">
              Danh sách {PHAT_AM_TRACKS.length} bài nghe phát âm
            </h2>
          </div>
          <span className="text-xs font-medium text-[#5b6b80] sm:text-sm">
            8 trang có audio · 13 slide tài liệu
          </span>
        </div>
        <ol className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          {PHAT_AM_TRACKS.map((track) => {
            const slide = PHAT_AM_SLIDES[track.page];
            return (
              <li key={track.src}>
                <Link
                  href={phatAmPageHref(track.page)}
                  className="group flex h-full min-h-18 items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none sm:min-h-20 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm leading-snug font-semibold text-[#0d3f78] sm:text-base sm:leading-6">
                      {track.title}
                    </span>
                    {slide?.description ? (
                      <p className="mt-1 line-clamp-1 text-xs text-[#5b6b80]">
                        {slide.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1 sm:size-5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 rounded-2xl border border-[#dde5ee] bg-[#f6f8fb] p-4 sm:mt-10 sm:p-6">
          <div className="mb-3.5 flex items-center gap-2 sm:mb-4">
            <BookOpen className="size-4 text-[#1a5fa8] sm:size-5" aria-hidden />
            <h3 className="text-base font-bold text-[#10243f] sm:text-lg">
              Toàn bộ 13 slide tài liệu phát âm
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 sm:gap-2.5">
            {PHAT_AM_ALL_PAGES.map((page) => {
              const hasAudio = PHAT_AM_AUDIO_PAGES.includes(page);
              return (
                <Link
                  key={page}
                  href={phatAmPageHref(page)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition hover:shadow-sm sm:p-3 ${
                    hasAudio
                      ? "border-[#c3dbf4] bg-white text-[#0d3f78] hover:border-[#1a5fa8]"
                      : "border-[#dde5ee] bg-white/70 text-[#5b6b80] hover:border-[#91bbe8]"
                  }`}
                >
                  <span className="text-xs font-bold sm:text-sm">Trang {page}</span>
                  <span
                    className={`mt-0.5 text-[10px] font-medium sm:mt-1 sm:text-[11px] ${
                      hasAudio ? "text-[#1a5fa8]" : "text-[#7b8a9e]"
                    }`}
                  >
                    {hasAudio ? "Có audio" : "Lý thuyết"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </ListeningShell>
  );
}
