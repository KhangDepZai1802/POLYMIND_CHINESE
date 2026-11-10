import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import { LISTENING_TRACKS } from "@/features/listening/data";
import { BAI4_TITLE, BAI4_TRACKS } from "@/features/listening/bai4-data";
import { PHAT_AM_TITLE, PHAT_AM_TRACKS } from "@/features/listening/phat-am-data";

export const metadata: Metadata = {
  title: "Danh sách bài nghe",
  description:
    "Chọn bài học để mở tài liệu và audio luyện nghe của lớp Ban Giám đốc.",
  robots: { index: false, follow: false },
};

export default function ListeningIndexPage() {
  return (
    <ListeningShell classNameLabel="Học viện lãnh đạo">
      <section className="bg-[#0d3f78] px-4 py-8 text-white sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold tracking-[0.14em] text-[#91bbe8] uppercase sm:text-sm">
            Vietcombank · Học viện lãnh đạo
          </p>
          <h1 className="mt-2 text-2xl leading-tight font-bold sm:mt-3 sm:text-4xl">
            Bài nghe
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 sm:mt-4 sm:text-base sm:leading-7">
            Chọn bài học để xem tài liệu và nghe audio.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-3.5 py-6 sm:px-6 sm:py-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#10243f] sm:mb-5 sm:text-xl">
          <Headphones className="size-4 text-[#1a5fa8] sm:size-5" aria-hidden />
          Danh sách bài nghe
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <li>
            <Link
              href="/nghe/phat-am"
              className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none sm:min-h-32 sm:gap-4 sm:p-6"
            >
              <div>
                <span className="inline-block rounded-full bg-[#e6effa] px-2.5 py-0.5 text-xs font-semibold text-[#1a5fa8]">
                  Cơ bản
                </span>
                <h3 className="mt-1.5 text-lg font-bold text-[#0d3f78] sm:mt-2 sm:text-xl">
                  {PHAT_AM_TITLE}
                </h3>
                <p className="mt-1 text-xs text-[#5b6b80] sm:mt-2 sm:text-sm">
                  {PHAT_AM_TRACKS.length} audio · Cấu trúc âm tiết, thanh điệu & bảng ghép âm
                </p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1 sm:size-5"
                aria-hidden
              />
            </Link>
          </li>
          <li>
            <Link
              href="/nghe/bai-3"
              className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none sm:min-h-32 sm:gap-4 sm:p-6"
            >
              <div>
                <h3 className="text-lg font-bold text-[#0d3f78] sm:text-xl">
                  Bài 3 – Thời gian
                </h3>
                <p className="mt-1 text-xs text-[#5b6b80] sm:mt-2 sm:text-sm">
                  {LISTENING_TRACKS.length} audio · Từ vựng, mẫu câu và hội thoại
                </p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1 sm:size-5"
                aria-hidden
              />
            </Link>
          </li>
          <li>
            <Link
              href="/nghe/bai-4"
              className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none sm:min-h-32 sm:gap-4 sm:p-6"
            >
              <div>
                <h3 className="text-lg font-bold text-[#0d3f78] sm:text-xl">
                  {BAI4_TITLE}
                </h3>
                <p className="mt-1 text-xs text-[#5b6b80] sm:mt-2 sm:text-sm">
                  {BAI4_TRACKS.length} audio · Từ vựng, hỏi đường và hội thoại
                </p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1 sm:size-5"
                aria-hidden
              />
            </Link>
          </li>
        </ul>
      </section>
    </ListeningShell>
  );
}
