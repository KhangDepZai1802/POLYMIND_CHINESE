import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  GraduationCap,
  Headphones,
  Landmark,
  Mountain,
} from "lucide-react";
import { ListeningShell } from "@/features/listening/components/listening-shell";

export const metadata: Metadata = {
  title: "Bài nghe và tài liệu theo lớp",
  robots: { index: false, follow: false },
};

export default function ListeningIndexPage() {
  return (
    <ListeningShell classNameLabel="Không gian học tập">
      <section className="relative isolate overflow-hidden bg-linear-to-r from-[#124984] via-[#2068b5] to-[#a6d3ff] px-4 py-14 text-white sm:py-18">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-center justify-center sm:flex"
        >
          <div className="absolute size-72 rounded-full border-32 border-white/10" />
          <Landmark
            className="absolute right-0 bottom-0 size-44 translate-y-5 text-white/15"
            strokeWidth={1}
          />
          <Headphones
            className="size-44 -rotate-12 text-white/90 drop-shadow-[0_16px_15px_rgba(4,43,104,0.4)]"
            strokeWidth={1.5}
          />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-[#91bbe8] uppercase">
            POLYMIND · Tiếng Trung
          </p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold sm:text-4xl">
            Bài nghe và tài liệu
          </h1>
        </div>
      </section>
      <nav
        aria-label="Chọn lớp học"
        className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6"
      >
        {[
          {
            href: "/nghe/tieng-trung-ngan-hang",
            title: "Tiếng Trung ngân hàng",
            Icon: Building2,
            Decoration: Landmark,
            color: "bg-blue-100/80 text-[#2673c4]",
            accent: "bg-[#1875ce]",
          },
          {
            href: "/nghe/hoc-vien-lanh-dao",
            title: "Học viện lãnh đạo",
            Icon: GraduationCap,
            Decoration: Mountain,
            color: "bg-violet-100/80 text-[#6560b4]",
            accent: "bg-[#8566ee]",
          },
        ].map(({ href, title, Icon, Decoration, color, accent }) => (
          <Link
            key={href}
            href={href}
            className="group relative isolate flex min-h-52 items-center gap-6 overflow-hidden rounded-2xl border border-[#d0e2fb] bg-linear-to-br from-white to-[#f6f9ff] p-6 shadow-[0_8px_24px_-10px_rgba(37,99,180,0.22)] transition hover:-translate-y-1 hover:border-[#8cb9ed] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-[#1a5fa8] sm:p-8"
          >
            <Decoration
              aria-hidden
              className="pointer-events-none absolute -right-5 -bottom-5 -z-10 size-36 text-blue-100/50"
              strokeWidth={1}
            />
            <span
              className={`flex size-20 shrink-0 items-center justify-center rounded-2xl sm:size-24 ${color}`}
            >
              <Icon
                aria-hidden
                className="size-12 drop-shadow-sm sm:size-14"
                strokeWidth={1.5}
              />
            </span>
            <div className="min-w-0 flex-1">
              <span
                aria-hidden
                className={`mb-5 block h-1 w-10 rounded-full ${accent}`}
              />
              <h2 className="text-xl leading-relaxed font-bold text-[#0d3f78] sm:text-2xl">
                {title}
              </h2>
            </div>
          </Link>
        ))}
      </nav>
    </ListeningShell>
  );
}
