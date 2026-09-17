import type { Metadata } from "next";
import { Compass, HeartHandshake, Lightbulb, UsersRound } from "lucide-react";
import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-site";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: "Tìm hiểu định hướng đào tạo và giá trị của POLYMIND.",
  alternates: { canonical: "/gioi-thieu" },
};

export default function AboutPage() {
  const values = [
    {
      icon: Compass,
      title: "Đúng định hướng",
      text: "Bắt đầu từ mục tiêu và bối cảnh sử dụng của người học.",
    },
    {
      icon: Lightbulb,
      title: "Học để ứng dụng",
      text: "Ưu tiên thực hành, phản xạ và khả năng vận dụng kiến thức.",
    },
    {
      icon: UsersRound,
      title: "Đồng hành sát sao",
      text: "Quan sát tiến độ để phản hồi và điều chỉnh kịp thời.",
    },
    {
      icon: HeartHandshake,
      title: "Tôn trọng khác biệt",
      text: "Mỗi người học có điểm xuất phát và nhịp độ riêng.",
    },
  ];
  return (
    <MarketingPage>
      <MarketingHero
        eyebrow="Về POLYMIND"
        title="Tiếng Trung là một năng lực để mở rộng cơ hội"
        description="POLYMIND hướng đến một trải nghiệm học rõ mục tiêu, sát thực tế và có thể nhìn thấy tiến bộ."
      />
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-primary font-bold">Câu chuyện của chúng tôi</p>
            <h2 className="mt-3 text-3xl font-bold">
              Xây nền tảng vững chắc cho hành trình dài hạn
            </h2>
          </div>
          <div className="space-y-4 leading-8 text-[#5f7085]">
            <p>
              POLYMIND xây dựng môi trường học tiếng Trung gắn với mục tiêu
              thật: giao tiếp, học tập, thi chứng chỉ và làm việc.
            </p>
            <p>
              Thay vì chạy theo một khuôn mẫu duy nhất, lộ trình được tổ chức
              theo năng lực đầu vào, thời gian và nhu cầu ứng dụng của từng
              người học.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-[#f5f9fd] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-primary font-bold">Giá trị theo đuổi</p>
            <h2 className="mt-3 text-3xl font-bold">
              Học rõ ràng, tiến bộ bền vững
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <Icon className="text-primary size-7" />
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#65758a]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-primary font-bold">Đội ngũ giảng dạy</p>
          <h2 className="mt-3 text-3xl font-bold">
            Người hướng dẫn đồng hành cùng tiến độ
          </h2>
          <p className="mt-5 leading-8 text-[#65758a]">
            Thông tin chi tiết về đội ngũ giảng viên sẽ được cập nhật sau khi
            nội dung chính thức được POLYMIND cung cấp.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
