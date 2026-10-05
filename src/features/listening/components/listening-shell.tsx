import Link from "next/link";
import { Headphones } from "lucide-react";

import { Logo } from "@/components/shared/logo";

export function ListeningShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-page flex min-h-screen flex-col text-[#10243f]">
      <header className="sticky top-0 z-40 border-b border-[#dde5ee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/nghe"
            className="flex items-center gap-3"
            aria-label="Bài nghe – Trang tổng hợp"
          >
            <Logo height={42} priority />
            <span className="hidden sm:block">
              <span className="block text-xs font-bold tracking-[0.12em] text-[#1a5fa8] uppercase">
                Lớp Ban Giám đốc
              </span>
              <span className="block text-sm font-semibold text-[#10243f]">
                Bài 3 · Thời gian
              </span>
            </span>
          </Link>
          <Link
            href="/nghe"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c3dbf4] px-4 text-sm font-bold text-[#134b86] transition hover:border-[#fb9518] hover:bg-[#fff4dd]"
          >
            <Headphones className="size-4" aria-hidden />
            Tất cả bài nghe
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-12 bg-[#0c2c4d] px-4 py-6 text-center text-xs text-white/65">
        POLYMIND · Tài liệu nghe Bài 3 – Thời gian
      </footer>
    </div>
  );
}
