import type { Metadata } from "next";
import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-site";
export const metadata: Metadata = {
  title: "Chương trình học",
  robots: { index: false, follow: true },
};
export default function ProgramsPage() {
  return (
    <MarketingPage>
      <MarketingHero
        eyebrow="Chương trình học"
        title="Nội dung đang được hoàn thiện"
        description="POLYMIND sẽ bổ sung thông tin chi tiết về từng chương trình trong bước tiếp theo."
      />
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-[#65758a] sm:px-6 lg:px-8">
        Vui lòng quay lại sau để xem lộ trình và thông tin khóa học.
      </div>
    </MarketingPage>
  );
}
