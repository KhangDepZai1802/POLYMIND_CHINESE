import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";

import { ListeningShell } from "@/features/listening/components/listening-shell";
import { LISTENING_TRACKS, listeningPageHref } from "@/features/listening/data";

export const metadata: Metadata = {
  title: "Bài nghe Bài 3 – Thời gian",
  description:
    "Bộ audio luyện nghe Bài 3 – Thời gian dành cho lớp Ban Giám đốc.",
  robots: { index: false, follow: false },
};

export default function ListeningIndexPage() {
  return (
    <ListeningShell>
      <section className="bg-[#0d3f78] px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-[0.14em] text-[#91bbe8] uppercase">
            Vietcombank · Học viện lãnh đạo
          </p>
          <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-4xl">
            Bài nghe Bài 3 – Thời gian
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-white/75">
            Chọn đúng số trang trong tài liệu để nghe từ vựng, mẫu câu và hội
            thoại.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-center gap-2">
          <Headphones className="size-5 text-[#1a5fa8]" aria-hidden />
          <h2 className="text-xl font-bold text-[#10243f]">
            Danh sách 22 audio
          </h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {LISTENING_TRACKS.map((track) => (
            <li key={track.src}>
              <Link
                href={listeningPageHref(track.page)}
                className="group flex h-full min-h-20 items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none"
              >
                <span className="leading-6 font-semibold text-[#0d3f78]">
                  {track.title}
                </span>
                <ArrowRight
                  className="size-5 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </ListeningShell>
  );
}
