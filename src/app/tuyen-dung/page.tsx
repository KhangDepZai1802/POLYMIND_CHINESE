import type { Metadata } from "next";
import {
  BriefcaseBusiness,
  Clock3,
  GraduationCap,
  MapPin,
  Send,
} from "lucide-react";
import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-site";

export const metadata: Metadata = {
  title: "Tuyển dụng",
  description: "Cơ hội đồng hành cùng POLYMIND.",
  alternates: { canonical: "/tuyen-dung" },
};

const jobs = [
  {
    title: "Giáo viên tiếng Trung",
    icon: GraduationCap,
    description: [
      "Giảng dạy theo chương trình và lộ trình của trung tâm",
      "Theo dõi, nhận xét và hỗ trợ tiến độ học viên",
    ],
    requirements: [
      "Có năng lực tiếng Trung phù hợp với vị trí",
      "Trách nhiệm, giao tiếp tốt và yêu thích giảng dạy",
    ],
  },
  {
    title: "Trợ giảng tiếng Trung",
    icon: GraduationCap,
    description: [
      "Hỗ trợ giáo viên trong lớp học",
      "Chuẩn bị học liệu và hỗ trợ học viên ôn tập",
    ],
    requirements: [
      "Chủ động, cẩn thận và có tinh thần học hỏi",
      "Có nền tảng tiếng Trung là một lợi thế",
    ],
  },
  {
    title: "Nhân viên tư vấn tuyển sinh",
    icon: BriefcaseBusiness,
    description: [
      "Tìm hiểu nhu cầu và tư vấn lộ trình phù hợp",
      "Chăm sóc người học trước và sau khi đăng ký",
    ],
    requirements: [
      "Giao tiếp rõ ràng, kiên nhẫn",
      "Có tinh thần phục vụ và làm việc theo mục tiêu",
    ],
  },
  {
    title: "Nhân viên hành chính – học vụ",
    icon: BriefcaseBusiness,
    description: [
      "Hỗ trợ vận hành lớp, lịch học và hồ sơ",
      "Phối hợp cùng giáo viên và bộ phận tư vấn",
    ],
    requirements: [
      "Tổ chức công việc tốt và sử dụng công cụ văn phòng",
      "Cẩn thận, đúng giờ và có trách nhiệm",
    ],
  },
];

export default function CareersPage() {
  return (
    <MarketingPage>
      <MarketingHero
        eyebrow="Cơ hội nghề nghiệp"
        title="POLYMIND tuyển dụng"
        description="Cùng xây dựng một môi trường học tiếng Trung thực tiễn, chuyên nghiệp và luôn hướng đến tiến bộ của người học."
      />
      <section className="bg-gradient-to-b from-white to-[#eef6ff] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-bold tracking-wide text-[#e82129] uppercase">
            Gia nhập đội ngũ POLYMIND
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-[#215cac] sm:text-4xl">
            Cơ hội phát triển trong môi trường giáo dục
          </h2>
          <p className="mx-auto mt-5 max-w-3xl leading-8 text-[#5f7085]">
            Danh sách dưới đây đang dùng nội dung khung theo trang mẫu. Bạn có
            thể thay mô tả, yêu cầu, quyền lợi và thời gian làm việc khi có
            thông tin chính thức.
          </p>
        </div>
      </section>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl space-y-7 px-4 sm:px-6 lg:px-8">
          {jobs.map(
            ({ title, icon: Icon, description, requirements }, index) => (
              <article
                key={title}
                className="overflow-hidden rounded-2xl border border-[#b6bfcb] bg-white shadow-[0_8px_30px_rgba(33,92,172,.06)]"
              >
                <div className="flex flex-col gap-5 border-b border-[#e4ebf3] bg-[#f7fbff] p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 items-center justify-center rounded-full bg-[#215cac] text-white">
                      <Icon className="size-6" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#e82129]">
                        Vị trí {String(index + 1).padStart(2, "0")}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-[#215cac] sm:text-2xl">
                        {title}
                      </h2>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#ffb32c] px-4 py-2 text-sm font-bold text-white sm:self-auto">
                    <MapPin className="size-4" /> Cơ sở cập nhật sau
                  </span>
                </div>
                <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#215cac]">
                      Mô tả công việc
                    </h3>
                    <ul className="mt-4 space-y-3 text-[#53647a]">
                      {description.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#e82129]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#215cac]">
                      Yêu cầu
                    </h3>
                    <ul className="mt-4 space-y-3 text-[#53647a]">
                      {requirements.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#e82129]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#215cac]">
                      Quyền lợi
                    </h3>
                    <p className="mt-3 leading-7 text-[#53647a]">
                      Chính sách thu nhập, đào tạo và phúc lợi sẽ được cập nhật
                      theo thông báo tuyển dụng chính thức.
                    </p>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-[#215cac]">
                      <Clock3 className="size-5" /> Thời gian làm việc
                    </h3>
                    <p className="mt-3 leading-7 text-[#53647a]">
                      Lịch làm việc cụ thể sẽ được trao đổi theo từng vị trí.
                    </p>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      </section>
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 rounded-3xl bg-[#215cac] p-8 text-center text-white sm:p-10 lg:flex-row lg:text-left">
          <div>
            <h2 className="text-2xl font-bold">
              Bạn muốn đồng hành cùng POLYMIND?
            </h2>
            <p className="mt-2 text-white/75">
              Kênh nhận hồ sơ đang được cập nhật.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e82129] px-6 py-3 font-bold">
            <Send className="size-4" /> Ứng tuyển ngay
          </span>
        </div>
      </section>
    </MarketingPage>
  );
}
