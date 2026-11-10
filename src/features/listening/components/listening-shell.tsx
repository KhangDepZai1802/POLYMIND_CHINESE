import Link from "next/link";
import { Headphones } from "lucide-react";

import { Logo } from "@/components/shared/logo";

export function ListeningShell({
  children,
  lesson,
  classNameLabel = "Học viện lãnh đạo",
}: {
  children: React.ReactNode;
  lesson?: string;
  classNameLabel?: string;
}) {
  return (
    <div className="bg-surface-page flex min-h-screen flex-col text-[#10243f]">
      <header className="sticky top-0 z-40 border-b border-[#dde5ee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-3.5 py-2.5 sm:min-h-18 sm:gap-4 sm:px-6 sm:py-3">
          <Link
            href="/nghe"
            className="flex items-center gap-2.5 sm:gap-3"
            aria-label="Bài nghe – Trang tổng hợp"
          >
            <Logo height={36} priority className="h-9 w-9 sm:h-[42px] sm:w-[42px]" />
            <span className="hidden sm:block">
              <span className="block text-xs font-bold tracking-[0.12em] text-[#1a5fa8] uppercase">
                {classNameLabel}
              </span>
              <span className="block text-sm font-semibold text-[#10243f]">
                {lesson ?? "Danh sách bài nghe"}
              </span>
            </span>
          </Link>
          <Link
            href="/nghe"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#c3dbf4] px-3 text-xs font-bold text-[#134b86] transition hover:border-[#fb9518] hover:bg-[#fff4dd] sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Headphones className="size-3.5 sm:size-4" aria-hidden />
            <span>Tất cả bài nghe</span>
          </Link>
        </div>
      </header>
      <main className="min-w-0 flex-1 break-words">{children}</main>
      <footer className="mt-12 bg-[#0c2c4d] px-4 py-6 text-center text-xs text-white/65">
        POLYMIND
      </footer>
    </div>
  );
}
