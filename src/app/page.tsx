import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  MessageCircleMore,
  Newspaper,
  Quote,
  Route,
  ShieldCheck,
  Star,
  Target,
  UsersRound,
} from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-site";

export const metadata: Metadata = {
  title: { absolute: "POLYMIND - ĐÀO TẠO NGOẠI NGỮ" },
  description:
    "POLYMIND - Trung tâm đào tạo ngoại ngữ với lộ trình rõ ràng, nội dung thực tiễn và tiến độ học tập minh bạch.",
  alternates: { canonical: "/" },
};

const programs = [
  {
    icon: MessageCircleMore,
    title: "Tiếng Trung giao tiếp",
    text: "Rèn phát âm và phản xạ qua những tình huống gần với đời sống, học tập và công việc.",
  },
  {
    icon: GraduationCap,
    title: "Lộ trình HSK",
    text: "Hệ thống kiến thức và kỹ năng làm bài theo mục tiêu cụ thể của từng người học.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Tiếng Trung chuyên ngành",
    text: "Nội dung hướng đến giao thương, tài chính, đàm phán và bối cảnh làm việc thực tế.",
  },
];

export default function HomePage() {
  return (
    <MarketingPage>
      {/* HERO SECTION */}
      <section className="relative isolate flex min-h-[90vh] items-center overflow-hidden bg-white">
        {/* Modern animated gradient background */}
        <div className="absolute inset-0 -z-10 bg-white">
          <div className="absolute top-0 left-1/2 h-[600px] w-full max-w-[1200px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(26,95,168,0.15),transparent_50%)]" />
          <div className="absolute top-40 -left-20 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,149,24,0.08),transparent_60%)] mix-blend-multiply blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(26,95,168,0.1),transparent_60%)] mix-blend-multiply blur-3xl" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] bg-center" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="bg-primary-50 border-primary-100 mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm">
              <span className="bg-brand-orange h-2 w-2 animate-pulse rounded-full" />
              <p className="text-primary-700 text-xs font-bold tracking-[0.15em] uppercase">
                POLYMIND Chinese
              </p>
            </div>

            <h1 className="text-5xl leading-[1.1] font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-[4rem]">
              Học để sử dụng.
              <span className="from-primary-600 via-primary-500 mt-2 block bg-gradient-to-r to-sky-400 bg-clip-text text-transparent">
                Tiến bộ để vươn xa.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 font-medium text-slate-600">
              Lộ trình tiếng Trung thực tiễn, mục tiêu rõ ràng và tiến độ minh
              bạch cho người học và doanh nghiệp.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#tu-van"
                className="group bg-brand-red relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full px-8 font-bold text-white shadow-[0_8px_20px_-6px_rgba(200,16,46,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_25px_-6px_rgba(200,16,46,0.8)]"
              >
                <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform group-hover:translate-y-0" />
                <span className="relative flex items-center gap-2">
                  Đặt hẹn tư vấn
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </span>
              </a>
              <Link
                href="/gioi-thieu"
                className="hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 inline-flex h-14 items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5"
              >
                Tìm hiểu POLYMIND
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 border-t border-slate-100 pt-8 sm:grid-cols-3">
              {[
                "Lộ trình rõ ràng",
                "Học qua tình huống",
                "Theo dõi tiến độ",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check className="size-4" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative w-full max-w-[600px] lg:ml-auto">
            <div className="relative aspect-[4/3] w-full transform overflow-hidden rounded-[2.5rem] bg-slate-100 shadow-[0_20px_50px_-12px_rgba(13,63,120,0.25)] transition-transform duration-700 hover:scale-[1.02]">
              <div className="absolute inset-0 z-10 rounded-[2.5rem] border-[6px] border-white/60" />
              <Image
                src="/polymind-hero-classroom.webp"
                alt="Lớp học tiếng Trung thực tiễn tại POLYMIND"
                fill
                priority
                sizes="(max-width:1024px) 100vw, 600px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 mix-blend-multiply" />
            </div>

            {/* Floating glassmorphism card */}
            <div className="absolute -bottom-8 -left-8 flex animate-[bounce_6s_infinite] items-center gap-4 rounded-2xl border border-white/40 bg-white/80 p-5 shadow-[0_15px_35px_-5px_rgba(0,0,0,0.1)] backdrop-blur-md sm:left-[-10%]">
              <div className="from-brand-orange flex size-12 items-center justify-center rounded-xl bg-gradient-to-br to-orange-400 shadow-inner">
                <Route className="size-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Lộ trình học
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-800">
                  Rõ mục tiêu · Sát thực tế
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS SECTION */}
      <section className="relative z-20 -mt-10 mb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Target,
                title: "Học đúng mục tiêu",
                text: "Nội dung bám sát nhu cầu sử dụng thực tế.",
              },
              {
                icon: UsersRound,
                title: "Theo sát người học",
                text: "Phản hồi và điều chỉnh theo tốc độ tiếp thu.",
              },
              {
                icon: ShieldCheck,
                title: "Minh bạch tiến độ",
                text: "Lịch học và kết quả được quản lý tập trung.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.1)]"
              >
                <div className="bg-primary-50 absolute -top-4 -right-4 size-24 rounded-full opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="bg-primary-50 text-primary-600 group-hover:bg-primary-600 flex size-14 items-center justify-center rounded-2xl transition-colors group-hover:text-white">
                    <Icon className="size-7" />
                  </div>
                  <h2 className="mt-6 text-xl font-bold text-slate-900">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 font-medium text-slate-600">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMS SECTION */}
      <section className="relative overflow-hidden bg-slate-50 py-24">
        <div className="bg-primary-100/40 absolute top-0 right-0 h-[800px] w-[800px] translate-x-1/3 -translate-y-1/2 rounded-full opacity-50 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2">
              <span className="bg-brand-orange h-1 w-8 rounded-full" />
              <p className="text-brand-orange text-sm font-extrabold tracking-widest uppercase">
                Định hướng đào tạo
              </p>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Mỗi mục tiêu cần một lộ trình phù hợp
            </h2>
            <p className="mt-5 text-lg leading-8 font-medium text-slate-600">
              Nội dung chi tiết từng chương trình sẽ được POLYMIND bổ sung sau.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {programs.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="group hover:shadow-primary-900/5 relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="from-primary-400 absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transform bg-gradient-to-r to-sky-400 transition-transform group-hover:scale-x-100" />
                <div>
                  <div className="from-primary-50 border-primary-100 text-primary-600 flex size-14 items-center justify-center rounded-2xl border bg-gradient-to-br to-sky-50 shadow-sm">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-slate-600">{text}</p>
                </div>
                <div className="text-primary-600 mt-8 flex -translate-x-4 items-center font-bold opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                  <span>Tìm hiểu thêm</span>
                  <ArrowRight className="ml-2 size-4" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WHY POLYMIND SECTION */}
      <section className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-brand-red text-sm font-extrabold tracking-widest uppercase">
              Vì sao người học lựa chọn POLYMIND
            </p>
            <h2 className="text-brand-navy mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
              Môi trường học tập được xây dựng quanh kết quả thực tế
            </h2>
          </div>

          <div className="mt-20 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
            {[
              "Lớp học chú trọng tương tác",
              "Lộ trình theo năng lực",
              "Thực hành theo tình huống",
              "Giảng viên theo sát tiến độ",
            ].map((title, index) => (
              <article key={title} className="group relative">
                <div className="absolute -inset-4 rounded-3xl bg-slate-50 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative text-center">
                  <div className="from-brand-navy to-primary-700 shadow-brand-navy/20 mx-auto flex size-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br text-3xl font-black text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3">
                    {index + 1}
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed font-medium text-slate-500">
                    Nội dung chi tiết sẽ được cập nhật theo thông tin chính thức
                    của POLYMIND.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* METHODOLOGY SECTION */}
      <section className="bg-brand-navy relative overflow-hidden py-24 sm:py-32">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-[url('/grid-light.svg')] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] bg-center opacity-10" />
        <div className="bg-primary-500/20 absolute -top-24 -right-24 size-96 rounded-full blur-3xl" />
        <div className="bg-brand-orange/20 absolute -bottom-24 -left-24 size-96 rounded-full blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2">
              <span className="bg-brand-orange h-2 w-2 rounded-full" />
              <p className="text-primary-200 text-sm font-bold tracking-[.15em] uppercase">
                Phương pháp POLYMIND
              </p>
            </div>
            <h2 className="text-4xl leading-tight font-extrabold text-white sm:text-5xl">
              Học có định hướng, <br className="hidden lg:block" /> không học
              trong mơ hồ
            </h2>
            <p className="text-primary-100 mt-6 max-w-xl text-lg leading-relaxed">
              Quy trình đào tạo chuẩn hóa giúp học viên nắm bắt được sự tiến bộ
              của bản thân qua từng giai đoạn cụ thể.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              ["01", "Hiểu mục tiêu"],
              ["02", "Thiết kế lộ trình"],
              ["03", "Học và thực hành"],
              ["04", "Đo lường tiến bộ"],
            ].map(([n, t]) => (
              <div
                key={n}
                className="group rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
              >
                <span className="group-hover:text-brand-orange text-5xl font-black text-white/10 transition-colors">
                  {n}
                </span>
                <h3 className="mt-4 text-xl font-bold text-white">{t}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS SECTION */}
      <section className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-brand-red text-sm font-extrabold tracking-widest uppercase">
              Kết quả người học
            </p>
            <h2 className="text-brand-navy mt-4 text-4xl font-extrabold sm:text-5xl">
              Tiến bộ đủ rõ để bạn có thể theo dõi
            </h2>
          </div>
          <div className="mt-20 grid gap-8 lg:grid-cols-3">
            {[
              "Phản xạ giao tiếp",
              "Nền tảng kiến thức",
              "Khả năng ứng dụng",
            ].map((title, index) => (
              <article
                key={title}
                className="group flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]"
              >
                <div className="from-primary-50 relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br to-sky-50">
                  <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30" />
                  <div className="from-primary-100/50 absolute inset-0 bg-gradient-to-t to-transparent" />
                  <GraduationCap className="text-primary-600 relative z-10 size-20 transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="flex flex-1 flex-col justify-between p-8">
                  <div>
                    <div className="flex gap-1.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="size-5 fill-current" />
                      ))}
                    </div>
                    <h3 className="mt-5 text-2xl font-bold text-slate-900">
                      {title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-slate-600">
                      Khu vực kết quả mẫu {index + 1}, chờ bổ sung dữ liệu và
                      hình ảnh thật.
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-brand-orange text-sm font-extrabold tracking-widest uppercase">
              Góc nhìn người học
            </p>
            <h2 className="text-brand-navy mt-4 text-4xl font-extrabold sm:text-5xl">
              Những chia sẻ trên hành trình học tập
            </h2>
          </div>
          <div className="mt-20 grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <article
                key={item}
                className="relative rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_10px_40px_-10px_rgba(13,63,120,0.1)] transition-transform hover:-translate-y-1"
              >
                <Quote className="fill-primary-100 text-primary-100 size-12" />
                <p className="mt-6 min-h-[7rem] text-lg leading-relaxed font-medium text-slate-700">
                  &quot;Nội dung nhận xét sẽ được thay bằng chia sẻ thật của học
                  viên sau khi POLYMIND cung cấp.&quot;
                </p>
                <div className="mt-8 flex items-center gap-4 border-t border-slate-100 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-400">
                    HV
                  </div>
                  <div>
                    <div className="text-brand-navy text-lg font-bold">
                      Học viên POLYMIND
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                      Học viên khóa tiếng Trung
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* BLOG SECTION */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-brand-red text-sm font-extrabold tracking-widest uppercase">
                POLYMIND Blog
              </p>
              <h2 className="text-brand-navy mt-4 text-3xl font-extrabold sm:text-4xl">
                Kiến thức và kinh nghiệm học tiếng Trung
              </h2>
            </div>
            <Link
              href="/blog"
              className="group text-primary-600 hover:text-primary-700 inline-flex shrink-0 items-center gap-2 font-bold"
            >
              Xem tất cả bài viết
              <span className="bg-primary-100 group-hover:bg-primary-200 flex size-8 items-center justify-center rounded-full transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              "Phương pháp học hiệu quả",
              "Kinh nghiệm luyện giao tiếp",
              "Định hướng chứng chỉ",
            ].map((title) => (
              <article
                key={title}
                className="group hover:shadow-primary-900/5 flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white transition-all hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="bg-primary-50 relative flex h-52 items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-50" />
                  <Newspaper className="text-primary-300 group-hover:text-primary-400 relative z-10 size-16 transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="flex flex-1 flex-col p-8">
                  <div className="mb-4 flex">
                    <span className="text-brand-red inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-bold tracking-wider uppercase">
                      Bài viết sắp có
                    </span>
                  </div>
                  <h3 className="group-hover:text-primary-600 text-xl font-bold text-slate-900 transition-colors">
                    {title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="from-brand-navy to-primary-800 relative overflow-hidden bg-gradient-to-r py-16 text-white">
        <div className="absolute inset-0 bg-[url('/grid-light.svg')] bg-center opacity-10" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-12 divide-x divide-white/10 px-4 text-center sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["Rõ ràng", "Lộ trình"],
            ["Thực tiễn", "Nội dung"],
            ["Liên tục", "Phản hồi"],
            ["Tập trung", "Tiến bộ"],
          ].map(([value, label], i) => (
            <div key={label} className={i === 0 || i === 2 ? "border-l-0" : ""}>
              <p className="text-brand-orange mb-3 text-4xl font-black drop-shadow-md sm:text-5xl">
                {value}
              </p>
              <p className="text-primary-100 text-lg font-bold tracking-widest uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        id="tu-van"
        className="relative scroll-mt-32 bg-white px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="bg-primary-50 absolute top-1/2 left-0 -z-10 h-[600px] w-[600px] -translate-y-1/2 rounded-full blur-3xl" />
        <div className="mx-auto max-w-5xl">
          <div className="from-primary-50 border-primary-100 shadow-primary-900/5 relative flex flex-col justify-between gap-12 overflow-hidden rounded-[3rem] border bg-gradient-to-br to-white p-10 text-center shadow-2xl sm:p-16 lg:flex-row lg:items-center lg:p-20 lg:text-left">
            <div className="absolute top-0 right-0 bg-[radial-gradient(circle_at_top_right,rgba(35,115,199,0.1),transparent_70%)] p-32" />

            <div className="relative z-10 max-w-2xl">
              <p className="text-primary-600 border-primary-100 mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-1.5 text-sm font-bold shadow-sm">
                🚀 Bắt đầu hành trình
              </p>
              <h2 className="text-4xl leading-tight font-black text-slate-900 sm:text-5xl">
                Sẵn sàng tìm lộ trình{" "}
                <span className="from-primary-600 bg-gradient-to-r to-sky-500 bg-clip-text text-transparent">
                  phù hợp nhất?
                </span>
              </h2>
              <p className="mt-6 text-lg font-medium text-slate-600">
                Kênh đặt hẹn tư vấn đang được cập nhật. Bạn vẫn có thể đăng nhập
                nếu đã là học viên, giáo viên hoặc quản lý.
              </p>
            </div>

            <div className="relative z-10 shrink-0">
              <Link
                href="/login"
                className="group bg-primary-600 relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-full px-10 font-bold text-white shadow-[0_8px_25px_-8px_rgba(26,95,168,0.8)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_-8px_rgba(26,95,168,0.9)] lg:w-auto"
              >
                <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform group-hover:translate-y-0" />
                <span className="relative flex items-center gap-3 text-lg">
                  Vào hệ thống đào tạo
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1.5" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
