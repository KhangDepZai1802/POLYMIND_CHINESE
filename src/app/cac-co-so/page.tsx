import type { Metadata } from "next";
import { Clock3, Map, MapPin, Navigation, Phone } from "lucide-react";
import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-site";

export const metadata: Metadata = {
  title: "Hệ thống cơ sở",
  description: "Thông tin hệ thống cơ sở POLYMIND.",
  alternates: { canonical: "/cac-co-so" },
};

const locations = ["Cơ sở trung tâm", "Cơ sở 02", "Cơ sở 03"];

export default function LocationsPage() {
  return (
    <MarketingPage>
      <MarketingHero
        eyebrow="POLYMIND Chinese"
        title="Hệ thống cơ sở"
        description="Tìm lớp học thuận tiện và xem đầy đủ thông tin liên hệ, thời gian hoạt động cùng hướng dẫn di chuyển."
      />
      <section className="bg-gradient-to-b from-white to-[#eef6ff] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-bold text-[#e82129]">Không gian học tập</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#215cac] sm:text-4xl">
              Chọn cơ sở POLYMIND gần bạn
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#5f7085]">
              Địa chỉ thật và bản đồ sẽ được thay vào sau. Hiện trang đã dựng
              đầy đủ bố cục giống mã nguồn mẫu để bạn chỉnh nội dung.
            </p>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-4">
              {locations.map((name, index) => (
                <article
                  key={name}
                  className={`rounded-2xl border p-6 shadow-sm ${index === 0 ? "border-[#215cac] bg-[#215cac] text-white" : "border-[#dfe7f0] bg-white"}`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-white/15" : "bg-[#eef6ff] text-[#215cac]"}`}
                    >
                      <MapPin className="size-5" />
                    </span>
                    <div>
                      <h2
                        className={`text-lg font-bold ${index === 0 ? "text-white" : "text-[#215cac]"}`}
                      >
                        {name}
                      </h2>
                      <p
                        className={`mt-2 text-sm leading-6 ${index === 0 ? "text-white/75" : "text-[#66778d]"}`}
                      >
                        Địa chỉ đang được cập nhật
                      </p>
                      <div
                        className={`mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold ${index === 0 ? "text-white/80" : "text-[#53647a]"}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5" /> Số điện thoại cập nhật
                          sau
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3.5" /> Giờ hoạt động cập nhật
                          sau
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="min-h-[520px] overflow-hidden rounded-3xl border-[10px] border-[#215cac] bg-[#e9f1f8] shadow-[0_15px_40px_rgba(33,92,172,.18)]">
              <div className="flex h-full min-h-[500px] flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_35%,rgba(33,92,172,.13),transparent_18%),linear-gradient(135deg,transparent_48%,rgba(33,92,172,.08)_49%,rgba(33,92,172,.08)_51%,transparent_52%)] p-8 text-center">
                <span className="flex size-20 items-center justify-center rounded-full bg-white text-[#e82129] shadow-xl">
                  <Map className="size-9" />
                </span>
                <h2 className="mt-6 text-2xl font-bold text-[#215cac]">
                  Bản đồ cơ sở
                </h2>
                <p className="mt-3 max-w-md leading-7 text-[#66778d]">
                  Khu vực này sẽ hiển thị Google Maps hoặc bản đồ nhúng khi bạn
                  cung cấp địa chỉ chính thức.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ffb32c] px-5 py-3 font-bold text-white">
                  <Navigation className="size-4" /> Xem đường đi
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            [
              "Thông tin rõ ràng",
              "Địa chỉ, thời gian và liên hệ ở cùng một nơi.",
            ],
            [
              "Thuận tiện di chuyển",
              "Hướng dẫn đường đi trực tiếp trên bản đồ.",
            ],
            [
              "Hỗ trợ nhanh chóng",
              "Kết nối với cơ sở phù hợp với nhu cầu học.",
            ],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e1e9f2] p-6"
            >
              <h2 className="font-bold text-[#215cac]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#66778d]">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
