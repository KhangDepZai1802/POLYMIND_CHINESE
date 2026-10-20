import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChineseSpeakButton } from "@/features/listening/components/chinese-speech";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import lessons from "@/features/listening/bank-lessons.json";

export const metadata: Metadata = {
  title: "Tiếng Trung ngân hàng",
  robots: { index: false, follow: false },
};

export default function BankIndexPage() {
  return (
    <ListeningShell
      classNameLabel="Tiếng Trung ngân hàng"
      lesson="Tiếng Trung ngân hàng"
    >
      <section className="bg-[#0d3f78] px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-[#91bbe8] uppercase">
            POLYMIND
          </p>
          <h1 className="mt-3 text-3xl font-bold">Tiếng Trung ngân hàng</h1>
          <p className="mt-4 leading-7 text-white/75">
            Từ vựng, ngữ pháp và hội thoại theo tài liệu lớp học.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h2 className="mb-5 text-xl font-bold">Danh sách bài học</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => (
            <li
              key={lesson.number}
              className="flex h-full items-center justify-between gap-3 rounded-2xl border border-[#c3dbf4] bg-white p-6 shadow-sm transition hover:border-[#1a5fa8] hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-sm font-bold text-[#1a5fa8]">
                    Bài {lesson.number}
                  </p>
                  <ChineseSpeakButton
                    text={lesson.title}
                    size="sm"
                    label={`Nghe tiêu đề Bài ${lesson.number}`}
                  />
                </div>
                <Link
                  href={`/nghe/tieng-trung-ngan-hang/bai-${lesson.number}`}
                  className="block rounded-lg focus-visible:outline-2 focus-visible:outline-[#1a5fa8]"
                >
                  <h3 className="text-lg leading-8 font-semibold text-[#0d3f78] hover:underline">
                    {lesson.title}
                  </h3>
                </Link>
              </div>
              <Link
                href={`/nghe/tieng-trung-ngan-hang/bai-${lesson.number}`}
                aria-label={`Mở Bài ${lesson.number}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#1a5fa8] transition hover:bg-[#eef5fc] focus-visible:outline-2 focus-visible:outline-[#1a5fa8]"
              >
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </ListeningShell>
  );
}
