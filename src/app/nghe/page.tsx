import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import { LISTENING_TRACKS } from "@/features/listening/data";
import { BAI4_TITLE, BAI4_TRACKS } from "@/features/listening/bai4-data";

export const metadata: Metadata = {
  title: "Danh sách bài nghe",
  description:
    "Chọn bài học để mở tài liệu và audio luyện nghe của lớp Ban Giám đốc.",
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
            Bài nghe
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-white/75">
            Chọn bài học để xem tài liệu và nghe audio.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-[#10243f]">
          <Headphones className="size-5 text-[#1a5fa8]" aria-hidden />
          Danh sách bài nghe
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/nghe/bai-3"
              className="group flex min-h-32 items-center justify-between gap-4 rounded-2xl border border-[#dde5ee] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none"
            >
              <div>
                <h3 className="text-xl font-bold text-[#0d3f78]">
                  Bài 3 – Thời gian
                </h3>
                <p className="mt-2 text-sm text-[#5b6b80]">
                  {LISTENING_TRACKS.length} audio · Từ vựng, mẫu câu và hội
                  thoại
                </p>
              </div>
              <ArrowRight
                className="size-5 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </li>
          <li>
            <Link
              href="/nghe/bai-4"
              className="group flex min-h-32 items-center justify-between gap-4 rounded-2xl border border-[#dde5ee] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#91bbe8] hover:shadow-md focus-visible:ring-3 focus-visible:ring-[#1a5fa8]/40 focus-visible:outline-none"
            >
              <div>
                <h3 className="text-xl font-bold text-[#0d3f78]">
                  {BAI4_TITLE}
                </h3>
                <p className="mt-2 text-sm text-[#5b6b80]">
                  {BAI4_TRACKS.length} audio · Từ vựng, hỏi đường và hội thoại
                </p>
              </div>
              <ArrowRight
                className="size-5 shrink-0 text-[#1a5fa8] transition group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </li>
        </ul>
      </section>
    </ListeningShell>
  );
}
