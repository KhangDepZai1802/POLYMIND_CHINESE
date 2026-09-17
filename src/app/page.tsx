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
  title: "Tiếng Trung thực tiễn cho học tập và công việc",
  description:
    "POLYMIND xây dựng lộ trình tiếng Trung rõ ràng, thực tiễn và có thể theo dõi tiến độ.",
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
      <section className="relative isolate overflow-hidden bg-[#f4f9ff]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(35,115,199,0.14),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(251,149,24,0.14),transparent_28%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
          <div>
            <p className="text-primary text-sm font-bold tracking-[0.15em] uppercase">
              POLYMIND Chinese
            </p>
            <h1 className="mt-4 text-4xl leading-[1.12] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Học để sử dụng.
              <span className="text-primary mt-2 block">
                Tiến bộ để vươn xa.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#53647a]">
              Lộ trình tiếng Trung thực tiễn, mục tiêu rõ ràng và tiến độ minh
              bạch cho người học và doanh nghiệp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#tu-van"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#e82129] px-6 font-bold text-white transition hover:bg-[#c8102e]"
              >
                Đặt hẹn tư vấn <ArrowRight className="size-4" />
              </a>
              <Link
                href="/gioi-thieu"
                className="border-primary-200 text-primary hover:bg-primary-50 inline-flex min-h-12 items-center rounded-full border bg-white px-6 font-bold"
              >
                Tìm hiểu POLYMIND
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold text-[#43536b]">
              {[
                "Lộ trình rõ ràng",
                "Học qua tình huống",
                "Theo dõi tiến độ",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="size-4 text-[#0e7490]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="relative lg:-mr-16">
            <div className="relative aspect-[3/2] overflow-hidden rounded-[2rem] border-8 border-white shadow-2xl shadow-[#0d3f78]/15">
              <Image
                src="/polymind-hero-classroom.webp"
                alt="Lớp học tiếng Trung thực tiễn tại POLYMIND"
                fill
                priority
                sizes="(max-width:1024px) 100vw,58vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl">
              <Route className="size-6 text-[#fb9518]" />
              <div>
                <p className="text-xs text-[#66778d]">Lộ trình học</p>
                <p className="font-bold">Rõ mục tiêu · Sát thực tế</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e4ebf3] bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-[#e4ebf3] px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
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
            <div key={title} className="flex gap-4 py-8 md:px-7 md:first:pl-0">
              <Icon className="text-primary mt-1 size-6 shrink-0" />
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#65758a]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-primary text-sm font-bold tracking-[0.15em] uppercase">
            Định hướng đào tạo
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Mỗi mục tiêu cần một lộ trình phù hợp
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-[#65758a]">
            Nội dung chi tiết từng chương trình sẽ được POLYMIND bổ sung sau.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {programs.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-3xl border border-[#dfe7f0] p-7 shadow-[0_12px_36px_rgba(13,63,120,.06)]"
              >
                <span className="bg-primary-50 text-primary flex size-12 items-center justify-center rounded-2xl">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-6 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-[#65758a]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-white to-[#eef6ff] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-bold text-[#e82129]">
              Vì sao người học lựa chọn POLYMIND
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold text-[#215cac] sm:text-4xl">
              Môi trường học tập được xây dựng quanh kết quả thực tế
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              "Lớp học chú trọng tương tác",
              "Lộ trình theo năng lực",
              "Thực hành theo tình huống",
              "Giảng viên theo sát tiến độ",
            ].map((title, index) => (
              <article
                key={title}
                className="rounded-3xl bg-white p-7 text-center shadow-[0_12px_35px_rgba(33,92,172,.1)] transition hover:-translate-y-1"
              >
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#215cac] text-xl font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold text-[#215cac]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#66778d]">
                  Nội dung chi tiết sẽ được cập nhật theo thông tin chính thức
                  của POLYMIND.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d3f78] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:px-8">
          <div>
            <p className="text-sm font-bold tracking-[.15em] text-[#91bbe8] uppercase">
              Phương pháp POLYMIND
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Học có định hướng, không học trong mơ hồ
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["01", "Hiểu mục tiêu"],
              ["02", "Thiết kế lộ trình"],
              ["03", "Học và thực hành"],
              ["04", "Đo lường tiến bộ"],
            ].map(([n, t]) => (
              <div
                key={n}
                className="rounded-2xl border border-white/15 bg-white/[.07] p-5"
              >
                <span className="font-bold text-[#fb9518]">{n}</span>
                <h3 className="mt-3 text-lg font-bold">{t}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-bold text-[#e82129]">Kết quả người học</p>
            <h2 className="mt-3 text-3xl font-bold text-[#215cac] sm:text-4xl">
              Tiến bộ đủ rõ để bạn có thể theo dõi
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              "Phản xạ giao tiếp",
              "Nền tảng kiến thức",
              "Khả năng ứng dụng",
            ].map((title, index) => (
              <article
                key={title}
                className="overflow-hidden rounded-3xl border border-[#e1e9f2] bg-white shadow-sm"
              >
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[#d3eeff] to-[#f7fbff]">
                  <GraduationCap className="size-16 text-[#215cac]/70" />
                </div>
                <div className="p-6">
                  <div className="flex gap-1 text-[#ffb32c]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-current" />
                    ))}
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-[#215cac]">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#66778d]">
                    Khu vực kết quả mẫu {index + 1}, chờ bổ sung dữ liệu và hình
                    ảnh thật.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f5f9fd] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-bold text-[#e82129]">Góc nhìn người học</p>
            <h2 className="mt-3 text-3xl font-bold text-[#215cac] sm:text-4xl">
              Những chia sẻ trên hành trình học tập
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <article
                key={item}
                className="rounded-2xl bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,.1)]"
              >
                <Quote className="size-9 fill-[#215cac] text-[#215cac]" />
                <p className="mt-5 min-h-28 leading-7 text-[#53647a]">
                  Nội dung nhận xét sẽ được thay bằng chia sẻ thật của học viên
                  sau khi POLYMIND cung cấp.
                </p>
                <div className="mt-5 border-t border-[#edf1f7] pt-5 font-bold text-[#215cac]">
                  Học viên POLYMIND
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="font-bold text-[#e82129]">POLYMIND Blog</p>
              <h2 className="mt-3 text-3xl font-bold text-[#215cac] sm:text-4xl">
                Kiến thức và kinh nghiệm học tiếng Trung
              </h2>
            </div>
            <Link
              href="/blog"
              className="text-primary hidden font-bold sm:block"
            >
              Xem tất cả →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              "Phương pháp học hiệu quả",
              "Kinh nghiệm luyện giao tiếp",
              "Định hướng chứng chỉ",
            ].map((title) => (
              <article
                key={title}
                className="overflow-hidden rounded-2xl border border-[#e1e9f2]"
              >
                <div className="flex h-44 items-center justify-center bg-[#eef6ff]">
                  <Newspaper className="size-14 text-[#215cac]/65" />
                </div>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-wider text-[#e82129] uppercase">
                    Bài viết sắp có
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-[#215cac]">
                    {title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#215cac] py-12 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 text-center sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["Rõ ràng", "Lộ trình"],
            ["Thực tiễn", "Nội dung"],
            ["Liên tục", "Phản hồi"],
            ["Tập trung", "Tiến bộ"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-3xl font-extrabold text-[#ffb32c] sm:text-4xl">
                {value}
              </p>
              <p className="mt-2 font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tu-van" className="scroll-mt-36 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 rounded-[2rem] bg-[#f4f9ff] p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <p className="text-primary font-bold">Bắt đầu hành trình</p>
            <h2 className="mt-2 text-3xl font-bold">
              Sẵn sàng tìm lộ trình phù hợp?
            </h2>
            <p className="mt-3 max-w-2xl text-[#65758a]">
              Kênh đặt hẹn tư vấn đang được cập nhật. Bạn vẫn có thể đăng nhập
              nếu đã là học viên, giáo viên hoặc quản lý.
            </p>
          </div>
          <Link
            href="/login"
            className="bg-primary hover:bg-primary-700 inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-6 font-bold text-white"
          >
            Vào hệ thống đào tạo
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}
