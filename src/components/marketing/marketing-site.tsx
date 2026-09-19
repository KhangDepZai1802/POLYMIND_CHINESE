import Link from "next/link";
import { BookOpen, ChevronDown, LogIn, Menu, Sparkles } from "lucide-react";

import { Logo } from "@/components/shared/logo";

const navigation = [
  { label: "Giới thiệu", href: "/gioi-thieu" },
  {
    label: "Chương trình học",
    href: "/chuong-trinh",
    children: [
      { label: "Tiếng Trung giao tiếp", href: "/chuong-trinh#giao-tiep" },
      {
        label: "Tiếng Trung cho người mới bắt đầu",
        href: "/chuong-trinh#nguoi-moi",
      },
      { label: "Luyện thi chứng chỉ HSK", href: "/chuong-trinh#hsk" },
      { label: "Tiếng Trung doanh nghiệp", href: "/chuong-trinh#doanh-nghiep" },
      {
        label: "Tiếng Trung đàm phán – tài chính",
        href: "/chuong-trinh#chuyen-nganh",
      },
    ],
  },
  { label: "Blog", href: "/blog" },
  { label: "Tuyển dụng", href: "/tuyen-dung" },
  { label: "Hệ thống cơ sở", href: "/cac-co-so" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0_1px_0_rgba(13,63,120,0.08)]">
      <div className="bg-[#215cac] text-white">
        <div className="mx-auto flex h-[38px] max-w-[1470px] items-center justify-center px-4 text-center text-[12px] font-bold uppercase sm:justify-between sm:px-8">
          <span className="hidden items-center gap-2 sm:inline-flex">
            <Sparkles className="size-3.5 text-[#fb9518]" aria-hidden />
            Tư vấn tuyển sinh
          </span>
          <span>Trung tâm tiếng Trung dành cho học tập và công việc</span>
          <span className="hidden items-center gap-1.5 lg:inline-flex">
            <BookOpen className="size-3.5" aria-hidden /> Học tập có lộ trình
          </span>
        </div>
      </div>

      <div className="mx-auto flex h-[112px] max-w-[1470px] items-center justify-between gap-8 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="POLYMIND CHINESE — Trang chủ"
          className="shrink-0"
        >
          <Logo height={52} priority />
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-8 xl:flex"
        >
          {navigation.map((item) => (
            <div
              key={item.href}
              className="group/nav relative flex h-[112px] items-center"
            >
              <Link
                href={item.href}
                className="hover:text-primary inline-flex items-center gap-1 text-base font-semibold text-[#3a3a3a] transition"
              >
                {item.label}
                {item.children && (
                  <ChevronDown
                    className="size-4 text-[#8494a8] transition group-hover/nav:rotate-180"
                    aria-hidden
                  />
                )}
              </Link>
              {item.children && (
                <div className="invisible absolute top-[96px] left-1/2 z-50 w-[470px] -translate-x-1/2 translate-y-2 pt-4 opacity-0 transition duration-200 group-focus-within/nav:visible group-focus-within/nav:translate-y-0 group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:translate-y-0 group-hover/nav:opacity-100">
                  <div className="relative rounded-[20px] border border-[#dedede] bg-white px-9 py-6 shadow-[0_12px_35px_rgba(0,0,0,.14)] before:absolute before:-top-2.5 before:left-1/2 before:size-5 before:-translate-x-1/2 before:rotate-45 before:border-t before:border-l before:border-[#dedede] before:bg-white">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="relative block border-b border-[#e5e5e5] py-3.5 text-[19px] font-normal text-[#6b6b6b] transition last:border-0 hover:pl-2 hover:text-[#215cac]"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/login"
            className="border-primary-200 text-primary hover:bg-primary-50 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition"
          >
            <LogIn className="size-4" aria-hidden /> Đăng nhập
          </Link>
          <Link
            href="/#tu-van"
            className="inline-flex min-h-11 items-center rounded-full bg-[#e82129] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c8102e]"
          >
            Đặt hẹn tư vấn
          </Link>
        </div>

        <details className="group relative sm:hidden">
          <summary className="border-primary-200 text-primary flex size-11 cursor-pointer list-none items-center justify-center rounded-full border [&::-webkit-details-marker]:hidden">
            <Menu className="size-5" aria-hidden />
            <span className="sr-only">Mở menu</span>
          </summary>
          <div className="absolute top-14 right-0 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-[#dde5ee] bg-white p-3 shadow-2xl">
            {navigation.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="hover:bg-primary-50 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold"
                >
                  {item.label}
                  {item.children && <ChevronDown className="size-4" />}
                </Link>
                {item.children && (
                  <div className="ml-3 border-l border-[#dfe7f0] pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block py-2 text-xs text-[#66778d]"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#edf1f7] pt-3">
              <Link
                href="/login"
                className="border-primary-200 text-primary flex items-center justify-center rounded-xl border px-3 py-3 text-sm font-bold"
              >
                Đăng nhập
              </Link>
              <Link
                href="/#tu-van"
                className="flex items-center justify-center rounded-xl bg-[#e82129] px-3 py-3 text-center text-sm font-bold text-white"
              >
                Tư vấn
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[#0c2c4d] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <Logo height={38} variant="plate" />
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            Tiếng Trung thực tiễn cho học tập, công việc và những cơ hội rộng
            mở.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase">
            Khám phá
          </h2>
          <div className="mt-4 grid gap-2.5 text-sm text-white/70">
            <Link href="/gioi-thieu" className="hover:text-white">
              Giới thiệu
            </Link>
            <Link href="/tuyen-dung" className="hover:text-white">
              Tuyển dụng
            </Link>
            <Link href="/cac-co-so" className="hover:text-white">
              Hệ thống cơ sở
            </Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase">
            Hệ thống đào tạo
          </h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Dành cho học viên, giáo viên và đội ngũ quản lý.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} POLYMIND. Đồng hành cùng bạn vươn xa.
      </div>
    </footer>
  );
}

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#10243f]">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function MarketingHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0d3f78] py-16 text-white sm:py-20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(145,187,232,0.24),transparent_30%),radial-gradient(circle_at_90%_80%,rgba(251,149,24,0.18),transparent_26%)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-bold tracking-[0.16em] text-[#91bbe8] uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
